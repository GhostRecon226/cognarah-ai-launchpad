import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, NAV_CATEGORIES } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { ArticleCard } from "@/components/site/article-card";
import type { Article } from "@/lib/types";
import { SITE_URL } from "@/lib/types";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search: Cognarah" },
      { name: "description", content: "Search Cognarah for AI news, startups, funding, tools, and analysis." },
      { property: "og:title", content: "Search: Cognarah" },
      { property: "og:description", content: "Search Cognarah for AI news, startups, funding, tools, and analysis across Africa and the world." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/search` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Search: Cognarah" },
      { name: "twitter:description", content: "Search Cognarah for AI news, startups, funding, tools, and analysis." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/search` }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [results, setResults] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from("articles")
        .select("*, author:authors(*), category:categories(*)")
        .eq("status", "published");
      if (q.trim()) query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);
      if (cat) {
        const { data: c } = await supabase.from("categories").select("id").eq("slug", cat).maybeSingle();
        if (c) query = query.eq("category_id", c.id);
      }
      query = query.order("published_at", { ascending: sort === "oldest" }).limit(50);
      const { data } = await query;
      setResults((data ?? []) as Article[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, cat, sort]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-12 text-navy-foreground">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h1 className="text-3xl font-bold">Search Cognarah</h1>
            <div className="mt-6 space-y-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <label htmlFor="search-q" className="sr-only">Search articles</label>
                <input
                  id="search-q"
                  autoFocus
                  aria-label="Search articles"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search articles…"
                  className="w-full rounded-md border border-white/20 bg-white/5 py-3 pl-11 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="search-cat" className="sr-only">Filter by category</label>
                <select id="search-cat" aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)} className="w-full min-w-0 rounded-md border border-white/20 bg-white/5 px-3 py-3 text-white sm:flex-1">
                  <option value="">All categories</option>
                  {NAV_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <label htmlFor="search-sort" className="sr-only">Sort order</label>
                <select id="search-sort" aria-label="Sort order" value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")} className="w-full min-w-0 rounded-md border border-white/20 bg-white/5 px-3 py-3 text-white sm:w-auto">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          {loading ? (
            <p className="text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-lg font-semibold">No results found</p>
              <p className="mt-2 text-muted-foreground">Try a different query or category.</p>
            </div>
          ) : (
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {results.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
