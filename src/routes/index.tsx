import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import type { Article } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { SITE_URL } from "@/lib/types";

async function loadHome(): Promise<{ articles: Article[] }> {
  const { data: articles } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(13);
  return { articles: (articles ?? []) as unknown as Article[] };
}

export const Route = createFileRoute("/")({
  loader: loadHome,
  head: () => ({
    meta: [
      { title: "Cognarah — Everything AI. Nothing Else." },
      { name: "description", content: "The definitive media platform for everything AI. News, startups, funding, tools, policy, and the global builders shaping AI." },
      { property: "og:title", content: "Cognarah — Everything AI. Nothing Else." },
      { property: "og:description", content: "The definitive media platform for everything AI." },
      { property: "og:url", content: SITE_URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: HomePage,
  errorComponent: ({ error }) => <div className="p-8">Error: {error.message}</div>,
  notFoundComponent: () => { throw notFound(); },
});

function HomePage() {
  const { articles } = Route.useLoaderData();
  const [featured, ...rest] = articles;
  const top = rest.slice(0, 4);
  const grid = rest.slice(4);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        {/* Hero */}
        {featured ? (
          <section className="bg-navy text-navy-foreground">
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
              <Link to="/article/$slug" params={{ slug: featured.slug }} className="overflow-hidden rounded-xl">
                {featured.hero_image && (
                  <img src={featured.hero_image} alt={featured.title} className="aspect-[16/10] w-full object-cover" />
                )}
              </Link>
              <div className="flex flex-col justify-center">
                {featured.category && (
                  <Link
                    to="/category/$slug"
                    params={{ slug: featured.category.slug }}
                    className="text-xs font-semibold uppercase tracking-widest text-brand"
                  >
                    {featured.category.name}
                  </Link>
                )}
                <Link to="/article/$slug" params={{ slug: featured.slug }}>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                    {featured.title}
                  </h1>
                </Link>
                {featured.excerpt && (
                  <p className="mt-4 text-lg text-white/70">{featured.excerpt}</p>
                )}
                <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
                  {featured.author?.name && <span>{featured.author.name}</span>}
                  {featured.author?.name && <span aria-hidden>·</span>}
                  <time>{formatDistanceToNow(new Date(featured.published_at ?? featured.created_at), { addSuffix: true })}</time>
                  <span aria-hidden>·</span>
                  <span>{featured.read_time} min read</span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-navy py-24 text-center text-navy-foreground">
            <div className="mx-auto max-w-2xl px-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Everything AI. Nothing Else.</h1>
              <p className="mt-4 text-white/70">First articles publishing soon.</p>
            </div>
          </section>
        )}

        {/* Top stories strip */}
        {top.length > 0 && (
          <section className="border-y bg-secondary">
            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              {top.map((a: Article) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}

        {/* Latest grid */}
        {grid.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Latest</h2>
              <Link to="/search" className="text-sm font-medium text-brand hover:underline">All articles →</Link>
            </div>
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {grid.map((a: Article) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}

        <NewsletterSignup variant="dark" />
      </main>
      <SiteFooter />
    </div>
  );
}
