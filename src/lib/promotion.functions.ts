import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SITE_URL } from "@/lib/types";

async function requireStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_any_role", {
    _user_id: context.userId,
    _roles: ["admin", "editor"],
  });
  if (error || !data) throw new Error("Forbidden");
}

const CHANNELS = ["linkedin", "x", "whatsapp", "newsletter", "other"] as const;

export function buildUtmLink(args: {
  slug: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string | null;
}): string {
  const url = new URL(`${SITE_URL}/article/${args.slug}`);
  url.searchParams.set("utm_source", args.source);
  url.searchParams.set("utm_medium", args.medium);
  url.searchParams.set("utm_campaign", args.campaign);
  if (args.content) url.searchParams.set("utm_content", args.content);
  return url.toString();
}

/**
 * Promotion queue: every published article from the last 90 days, rescored
 * against live traction and promotion history, ranked by promotion score.
 */
export const getPromotionQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const sb = context.supabase;
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [{ data: articles }, { data: views }, { data: promos }] = await Promise.all([
      sb
        .from("articles")
        .select(
          "id, title, slug, status, published_at, view_count, is_featured, hero_image, body, key_takeaways, tags, newsworthiness_score, newsworthiness_reason, africa_relevance_score, category:categories(name)",
        )
        .eq("status", "published")
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(200),
      sb.from("article_views").select("article_id").gte("occurred_at", sevenDaysAgo).limit(20000),
      sb.from("article_promotions").select("article_id, channel, promoted_at").order("promoted_at", { ascending: false }).limit(2000),
    ]);

    const views7d = new Map<string, number>();
    for (const v of (views ?? []) as any[]) {
      if (v.article_id) views7d.set(v.article_id, (views7d.get(v.article_id) ?? 0) + 1);
    }
    const promoCount = new Map<string, number>();
    const lastPromo = new Map<string, string>();
    const promoChannels = new Map<string, Set<string>>();
    for (const p of (promos ?? []) as any[]) {
      promoCount.set(p.article_id, (promoCount.get(p.article_id) ?? 0) + 1);
      if (!lastPromo.has(p.article_id)) lastPromo.set(p.article_id, p.promoted_at);
      const set = promoChannels.get(p.article_id) ?? new Set<string>();
      set.add(p.channel);
      promoChannels.set(p.article_id, set);
    }

    const { computePromotionScore } = await import("./editorial.server");

    const rows = ((articles ?? []) as any[]).map((a) => {
      const result = computePromotionScore({
        title: a.title,
        published_at: a.published_at,
        status: a.status,
        view_count: a.view_count ?? 0,
        tracked_views_7d: views7d.get(a.id) ?? 0,
        newsworthiness_score: a.newsworthiness_score ?? null,
        africa_relevance_score: a.africa_relevance_score ?? null,
        is_featured: !!a.is_featured,
        hero_image: a.hero_image ?? null,
        body: a.body ?? "",
        key_takeaways: a.key_takeaways ?? [],
        tags: a.tags ?? [],
        promotions_count: promoCount.get(a.id) ?? 0,
        last_promoted_at: lastPromo.get(a.id) ?? null,
      });
      return {
        id: a.id as string,
        title: a.title as string,
        slug: a.slug as string,
        category: a.category?.name ?? null,
        published_at: a.published_at as string | null,
        view_count: (a.view_count ?? 0) as number,
        views_7d: views7d.get(a.id) ?? 0,
        newsworthiness_score: (a.newsworthiness_score ?? null) as number | null,
        africa_relevance_score: (a.africa_relevance_score ?? null) as number | null,
        promotions_count: promoCount.get(a.id) ?? 0,
        last_promoted_at: lastPromo.get(a.id) ?? null,
        promoted_channels: Array.from(promoChannels.get(a.id) ?? []),
        promotion_score: result.score,
        promotion_reason: result.reason,
        promotion_signals: result.signals,
      };
    });

    rows.sort((a, b) => b.promotion_score - a.promotion_score);

    // Persist the freshly computed scores so the CMS shows the same numbers everywhere.
    await Promise.all(
      rows.slice(0, 60).map((r) =>
        sb
          .from("articles")
          .update({
            promotion_score: r.promotion_score,
            promotion_reason: r.promotion_reason,
            promotion_signals: r.promotion_signals,
            promotion_generated_at: new Date().toISOString(),
          })
          .eq("id", r.id),
      ),
    );

    return rows;
  });

/** Full promotion history for one article. */
export const listArticlePromotions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ article_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { data: rows, error } = await context.supabase
      .from("article_promotions")
      .select("*")
      .eq("article_id", data.article_id)
      .order("promoted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Log that an article was promoted on a channel. */
export const logPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        article_id: z.string().uuid(),
        channel: z.enum(CHANNELS),
        promoted_at: z.string().min(4).max(40).optional().nullable(),
        utm_source: z.string().max(120).optional().nullable(),
        utm_medium: z.string().max(120).optional().nullable(),
        utm_campaign: z.string().max(160).optional().nullable(),
        utm_content: z.string().max(160).optional().nullable(),
        note: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("article_promotions").insert({
      article_id: data.article_id,
      channel: data.channel,
      promoted_at: data.promoted_at ? new Date(data.promoted_at).toISOString() : new Date().toISOString(),
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_content: data.utm_content ?? null,
      note: data.note ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("article_promotions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** AI promotion copy for one article and channel, with the UTM link baked in. */
export const generatePromotionCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        article_id: z.string().uuid(),
        channel: z.enum(["linkedin", "x", "whatsapp", "newsletter"]),
        voice: z.enum(["cognarah", "founder"]).default("cognarah"),
        campaign: z.string().min(1).max(160).optional().nullable(),
        note: z.string().max(400).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { data: article, error } = await context.supabase
      .from("articles")
      .select("title, slug, excerpt, body, key_takeaways, tags, africa_relevance_score, category:categories(name)")
      .eq("id", data.article_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!article) throw new Error("Article not found");

    const mediumByChannel: Record<string, string> = {
      linkedin: "social",
      x: "social",
      whatsapp: "social",
      newsletter: "email",
    };
    const link = buildUtmLink({
      slug: (article as any).slug,
      source: data.channel,
      medium: mediumByChannel[data.channel] ?? "social",
      campaign: data.campaign?.trim() || "organic",
      content: data.voice,
    });

    const { generateSocialCopy } = await import("./social-copy.server");
    const copy = await generateSocialCopy({
      article: {
        title: (article as any).title,
        excerpt: (article as any).excerpt ?? null,
        body: (article as any).body ?? "",
        key_takeaways: (article as any).key_takeaways ?? [],
        tags: (article as any).tags ?? [],
        category: (article as any).category?.name ?? null,
        africa_relevance_score: (article as any).africa_relevance_score ?? null,
      },
      channel: data.channel,
      voice: data.voice,
      link,
      extraNote: data.note ?? null,
    });

    return { copy, link };
  });

/**
 * Score published articles that never went through the agent pipeline, so the
 * promotion queue is not ranking older posts with a missing newsworthiness
 * signal. Runs in small batches and skips anything already scored.
 */
export const backfillNewsworthiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(25).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const sb = context.supabase;
    const { data: rows, error } = await sb
      .from("articles")
      .select("id, title, slug, body")
      .eq("status", "published")
      .is("newsworthiness_score", null)
      .order("published_at", { ascending: false })
      .limit(data.limit ?? 10);
    if (error) throw new Error(error.message);

    const { assessNewsworthiness } = await import("./agent-core.server");
    let scored = 0;
    for (const a of (rows ?? []) as any[]) {
      try {
        const news = await assessNewsworthiness(a.title ?? "", `${SITE_URL}/article/${a.slug}`, a.body ?? "");
        await sb
          .from("articles")
          .update({ newsworthiness_score: news.score, newsworthiness_reason: news.reason })
          .eq("id", a.id);
        scored += 1;
      } catch {
        // Skip this article, keep going with the rest of the batch.
      }
    }
    const remaining = Math.max(0, (rows?.length ?? 0) - scored);
    return { scored, remaining_in_batch: remaining };
  });
