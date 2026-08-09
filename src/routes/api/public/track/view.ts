import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

// First-party article view tracking.
// Called from the browser once per article page view. Stores an anonymised
// event: no IP, no user agent, only a daily-rotating one-way fingerprint used
// for unique visitor counts and same-day de-duplication.

const bodySchema = z.object({
  slug: z.string().min(1).max(200),
  referrer: z.string().max(500).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(160).optional().nullable(),
  utm_content: z.string().max(160).optional().nullable(),
});

const SEARCH_HOSTS = ["google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "brave.", "baidu."];
const SOCIAL_HOSTS = [
  "linkedin.", "lnkd.in", "twitter.", "x.com", "t.co", "facebook.", "fb.", "instagram.",
  "reddit.", "news.ycombinator.com", "whatsapp.", "t.me", "telegram.", "threads.",
];
const EMAIL_HOSTS = ["mail.google.", "outlook.", "mail.yahoo.", "substack."];

function classify(host: string | null, utmMedium: string | null): string {
  const m = (utmMedium ?? "").toLowerCase();
  if (m.includes("email") || m.includes("newsletter")) return "email";
  if (m.includes("social") || m.includes("linkedin") || m.includes("twitter")) return "social";
  if (m.includes("cpc") || m.includes("paid")) return "paid";
  if (!host) return "direct";
  if (EMAIL_HOSTS.some((h) => host.includes(h))) return "email";
  if (SOCIAL_HOSTS.some((h) => host.includes(h))) return "social";
  if (SEARCH_HOSTS.some((h) => host.includes(h))) return "search";
  if (host.includes("cognarah.com")) return "internal";
  return "referral";
}

function hostOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/track/view")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ||
          (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
          "unknown";
        const ua = request.headers.get("user-agent") ?? "";
        if (/bot|crawler|spider|crawling|preview|headless|lighthouse/i.test(ua)) {
          return Response.json({ ok: true, skipped: "bot" });
        }

        const day = new Date().toISOString().slice(0, 10);
        const salt = process.env["AGENT_CRON_SECRET"] ?? "cognarah";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: article } = await supabaseAdmin
            .from("articles")
            .select("id")
            .eq("slug", parsed.slug)
            .eq("status", "published")
            .maybeSingle();
          if (!article) return Response.json({ ok: true, skipped: "unknown article" });

          // Campaign identity is part of the fingerprint so a campaign-tagged
          // visit is still recorded when the same person already read the
          // article untagged earlier the same day.
          const campaignKey = [parsed.utm_source, parsed.utm_medium, parsed.utm_campaign, parsed.utm_content]
            .map((v) => (v ?? "").toLowerCase().trim())
            .join("|");
          const visitorHash = createHash("sha256")
            .update(`${salt}|${day}|${ip}|${ua}|${article.id}|${campaignKey}`)
            .digest("hex");

          const host = hostOf(parsed.referrer);
          const { error } = await supabaseAdmin.from("article_views").insert({
            article_id: article.id,
            slug: parsed.slug,
            visitor_hash: visitorHash,
            referrer_host: host,
            source_group: classify(host, parsed.utm_medium ?? null),
            utm_source: parsed.utm_source ?? null,
            utm_medium: parsed.utm_medium ?? null,
            utm_campaign: parsed.utm_campaign ?? null,
            utm_content: parsed.utm_content ?? null,
          });
          // Unique index on (article_id, visitor_hash) makes repeat views a no-op.
          if (error && !error.message.toLowerCase().includes("duplicate")) {
            console.error("[track/view]", error.message);
          }
          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("[track/view]", e?.message || e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
