import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://cognarah.com";

const STATIC_PATHS = ["/", "/about", "/search", "/startups/submit", "/resources/skills", "/state-of-african-ai"];
const CATEGORIES = [
  "news", "startups", "funding", "tools", "trends", "opinions",
  "analysis", "interviews", "africa-ai", "policy-ethics", "events",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const [{ data: articles }, { data: authors }, { data: skills }] = await Promise.all([
          supabase.from("articles").select("slug, updated_at").eq("status", "published"),
          supabase.from("authors").select("slug, updated_at"),
          supabase.from("skills").select("slug, updated_at").eq("published", true),
        ]);

        const entries = [
          ...STATIC_PATHS.map((p) => ({ loc: `${BASE_URL}${p}`, changefreq: "weekly", priority: p === "/" ? "1.0" : "0.7" })),
          ...CATEGORIES.map((s) => ({ loc: `${BASE_URL}/category/${s}`, changefreq: "daily", priority: "0.8" })),
          ...((articles ?? []) as { slug: string; updated_at: string }[]).map((a) => ({
            loc: `${BASE_URL}/article/${a.slug}`,
            lastmod: a.updated_at,
            changefreq: "monthly",
            priority: "0.9",
          })),
          ...((authors ?? []) as { slug: string; updated_at: string }[]).map((au) => ({
            loc: `${BASE_URL}/authors/${au.slug}`,
            lastmod: au.updated_at,
            changefreq: "monthly",
            priority: "0.5",
          })),
          ...((skills ?? []) as { slug: string; updated_at: string }[]).map((s) => ({
            loc: `${BASE_URL}/resources/skills/${s.slug}`,
            lastmod: s.updated_at,
            changefreq: "monthly",
            priority: "0.6",
          })),
        ];

        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          entries.map((e) =>
            `  <url>\n    <loc>${e.loc}</loc>\n` +
            ((e as any).lastmod ? `    <lastmod>${(e as any).lastmod}</lastmod>\n` : "") +
            `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
          ).join("\n") + `\n</urlset>`;

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
