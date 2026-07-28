import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ----- shared helpers (all inside handlers to keep client bundle clean) -----

async function requireStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_any_role", {
    _user_id: context.userId,
    _roles: ["admin", "editor"],
  });
  if (error || !data) throw new Error("Forbidden");
}

// ================== SETTINGS ==================
export const getAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("agent_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      enabled: z.boolean(),
      cron_expression: z.string().min(1).max(120),
      default_count: z.number().int().min(1).max(3),
      default_focus: z.string().max(200).nullable().optional(),
      system_prompt: z.string().max(4000).nullable().optional(),
      search_time_window: z.enum(["qdr:h", "qdr:d", "qdr:w", "qdr:m", "qdr:y"]).optional(),
      query_presets: z.array(z.string().min(1).max(200)).max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const update: Record<string, unknown> = {
      enabled: data.enabled,
      cron_expression: data.cron_expression,
      default_count: data.default_count,
      default_focus: data.default_focus ?? null,
      system_prompt: data.system_prompt ?? null,
    };
    if (data.search_time_window) update.search_time_window = data.search_time_window;
    if (data.query_presets) update.query_presets = data.query_presets;
    const { error } = await context.supabase
      .from("agent_settings")
      .update(update as any)
      .eq("singleton", true);

    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ================== SOURCES ==================
export const listAgentSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("agent_sources")
      .select("*")
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addAgentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      label: z.string().min(1).max(120),
      kind: z.enum(["domain", "rss", "url", "skill_url"]),
      value: z.string().min(1).max(300),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("agent_sources").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAgentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("agent_sources").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { error } = await context.supabase.from("agent_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================== RUNS ==================
export const listAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ================== RUN THE AGENT ==================
// Dispatch the run to /api/public/hooks/agent-run so it executes in a fresh
// worker invocation with its own request lifetime. In-process ctx.waitUntil
// on Cloudflare-style runtimes doesn't reliably keep a multi-minute pipeline
// alive after the response returns, so we push the work to a sibling request.
export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      count: z.number().int().min(1).max(3).default(2),
      focus: z.string().max(200).nullable().optional(),
      category_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);

    const secret = process.env.AGENT_CRON_SECRET;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-create the run row so the UI has an id to poll immediately.
    const { data: runRow, error: runErr } = await supabaseAdmin
      .from("agent_runs")
      .insert({
        triggered_by: context.userId,
        trigger: "manual",
        status: "running",
        requested_count: data.count,
        focus: data.focus ?? null,
      })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);
    const runId = runRow.id as string;

    async function markError(message: string) {
      try {
        await supabaseAdmin
          .from("agent_runs")
          .update({ status: "error", error: message, finished_at: new Date().toISOString() })
          .eq("id", runId);
      } catch { /* best-effort */ }
    }

    if (!secret) {
      await markError("AGENT_CRON_SECRET is not set; cannot dispatch background run");
      throw new Error("AGENT_CRON_SECRET is not set on the server");
    }

    const base =
      process.env.PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://cognarah.com";
    const url = base.replace(/\/$/, "") + "/api/public/hooks/agent-run";

    const dispatch = fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-cron-secret": secret,
      },
      body: JSON.stringify({
        run_id: runId,
        count: data.count,
        focus: data.focus ?? null,
        category_id: data.category_id ?? null,
        triggered_by: context.userId,
      }),
    }).then(async (res) => {
      // Only treat a failed *dispatch* as an error. The hook itself may take
      // many minutes; when it succeeds it updates the run row directly.
      if (!res.ok && res.status !== 200) {
        const text = await res.text().catch(() => "");
        await markError(`Dispatch failed: HTTP ${res.status} ${text.slice(0, 200)}`);
      }
    }).catch(async (err) => {
      await markError(`Dispatch failed: ${String(err?.message || err)}`);
    });

    const { runInBackground } = await import("./background.server");
    runInBackground(dispatch);

    return { run_id: runId, status: "started", drafts_created: 0 };
  });


// ================== RUN SKILLS AGENT ==================
export const runSkillsAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      count: z.number().int().min(1).max(5).default(2),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const { runSkillsAgentCore } = await import("./agent-skills.server");
    return runSkillsAgentCore({
      supabase: context.supabase,
      triggeredBy: context.userId,
      trigger: "manual",
      count: data.count,
    });
  });

// ================== HERO IMAGE ACTIONS ==================

async function loadArticleForHero(supabase: any, articleId: string) {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,excerpt,slug,hero_image")
    .eq("id", articleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Article not found");
  return data as { id: string; title: string; excerpt: string | null; slug: string; hero_image: string | null };
}

// Resolve a proxy /api/public/media/... path or public URL into a fetchable absolute URL.
function resolveHeroUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith("/api/public/media/")) {
    const base = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://cognarah.com";
    return base.replace(/\/$/, "") + input;
  }
  return input;
}

export const validateArticleHero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      article_id: z.string().uuid(),
      image_url: z.string().min(1).max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const article = await loadArticleForHero(context.supabase, data.article_id);
    const url = data.image_url || article.hero_image;
    if (!url) return { ok: false, reason: "No hero image set" };
    const { downloadImage, isImageRelevant, sniffImageDimensions, isGenericOgImage } =
      await import("./agent-core.server");
    const gate = isGenericOgImage(url, article.slug);
    if (!gate.ok) return { ok: false, reason: gate.reason ?? "URL looks generic" };
    const dl = await downloadImage(resolveHeroUrl(url));
    if (!dl) return { ok: false, reason: "Could not download image (bad URL, size, or content-type)" };
    const dims = sniffImageDimensions(dl.buf);
    if (dims && (dims.width < 600 || dims.height < 400)) {
      return { ok: false, reason: `Image too small (${dims.width}×${dims.height}); need at least 600×400` };
    }
    const rel = await isImageRelevant(dl.buf, dl.contentType, article.title, article.excerpt ?? "");
    return { ok: rel.ok, reason: rel.reason };
  });

export const regenerateArticleHero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      article_id: z.string().uuid(),
      custom_prompt: z.string().max(400).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireStaff(context);
    const article = await loadArticleForHero(context.supabase, data.article_id);
    const { generateAiImage, isImageRelevant, uploadToMedia } = await import("./agent-core.server");
    const title = data.custom_prompt?.trim() || article.title;
    const dek = article.excerpt ?? "";
    // Try up to 2 generations; require vision-relevance pass.
    let heroPath: string | null = null;
    let lastReason = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const gen = await generateAiImage(title, dek);
      if (!("buf" in gen)) { lastReason = `attempt ${attempt}: ${gen.error}`; continue; }
      const rel = await isImageRelevant(gen.buf, "image/png", article.title, dek);
      if (!rel.ok) { lastReason = `attempt ${attempt}: ${rel.reason}`; continue; }
      heroPath = await uploadToMedia(gen.buf, "image/png", article.slug);
      if (heroPath) { lastReason = `attempt ${attempt}: ${rel.reason}`; break; }
      lastReason = "upload failed";
    }
    if (!heroPath) throw new Error(`Could not regenerate hero, ${lastReason}`);
    const { error } = await context.supabase
      .from("articles")
      .update({ hero_image: heroPath })
      .eq("id", data.article_id);
    if (error) throw new Error(error.message);
    return { ok: true, hero_image: heroPath, reason: lastReason };
  });

