import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { withEdgeCache } from "@/lib/edge-cache.server";
import { SITE_URL as BASE_URL } from "@/lib/types";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => withEdgeCache(request, async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data: articles } = await supabase
          .from("articles")
          .select("slug, title, excerpt, meta_description, body, published_at, category:categories(name)")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(100);

        const lines: string[] = [
          "# Cognarah, full article summaries",
          "",
          "> Concatenated summaries of the latest Cognarah articles for LLM and AI-search ingestion. Everything AI. Nothing Else.",
          "",
        ];

        for (const a of ((articles ?? []) as unknown) as Array<{
          slug: string;
          title: string;
          excerpt: string | null;
          meta_description: string | null;
          body: string;
          published_at: string | null;
          category: { name: string } | null;
        }>) {
          const url = `${BASE_URL}/article/${a.slug}`;
          const summary =
            a.meta_description ||
            a.excerpt ||
            (a.body ? a.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) : "");
          lines.push(`## ${a.title}`);
          lines.push(`URL: ${url}`);
          if (a.category?.name) lines.push(`Category: ${a.category.name}`);
          if (a.published_at) lines.push(`Published: ${a.published_at}`);
          if (summary) lines.push("", summary);
          lines.push("");
        }

        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }),
    },
  },
});
