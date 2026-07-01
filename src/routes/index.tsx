import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import type { Article } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { SITE_URL } from "@/lib/types";

async function loadHome(): Promise<{ articles: Article[]; africa: Article | null }> {
  const { data: articles } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const list = (articles ?? []) as unknown as Article[];
  const africa =
    list.find((a) => a.category?.slug === "africa-ai") ?? null;

  return { articles: list, africa };
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
  const { articles, africa } = Route.useLoaderData() as { articles: Article[]; africa: Article | null };

  // Exclude the Africa spotlight from the rest of the layout so it has a dedicated band.
  const pool = africa ? articles.filter((a) => a.id !== africa.id) : articles;
  const [lead, second, third, ...rest] = pool;
  const latest = rest.slice(0, 9);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />

      {/* Tagline strip directly under the navigation */}
      <div className="border-b border-white/10 bg-navy text-navy-foreground">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
          <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--brand-soft)]">
            Everything AI. Nothing Else.
          </p>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero — newspaper-style split: 60% lead, 40% secondary stack */}
        {lead ? (
          <section className="bg-navy text-navy-foreground">
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-5 lg:gap-12 lg:py-16">
              {/* Lead — 3/5 ≈ 60% */}
              <article className="lg:col-span-3">
                <Link
                  to="/article/$slug"
                  params={{ slug: lead.slug }}
                  className="block overflow-hidden rounded-md"
                >
                  {lead.hero_image && (
                    <img
                      src={mediaUrl(lead.hero_image)}
                      alt={lead.title}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  )}
                </Link>
                <div className="mt-6">
                  {lead.category && (
                    <Link
                      to="/category/$slug"
                      params={{ slug: lead.category.slug }}
                      className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--category)] hover:text-white"
                    >
                      {lead.category.name}
                    </Link>
                  )}
                  <Link to="/article/$slug" params={{ slug: lead.slug }}>
                    <h1 className="font-display mt-3 text-[28px] leading-[1.05] text-white sm:text-4xl lg:text-5xl">
                      {lead.title}
                    </h1>
                  </Link>
                  {lead.excerpt && (
                    <p className="mt-4 max-w-2xl text-base text-white/70">
                      {lead.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
                    {lead.author?.name && <span>{lead.author.name}</span>}
                    {lead.author?.name && <span aria-hidden>·</span>}
                    <time>
                      {formatDistanceToNow(new Date(lead.published_at ?? lead.created_at), { addSuffix: true })}
                    </time>
                    <span aria-hidden>·</span>
                    <span>{lead.read_time} min read</span>
                  </div>
                </div>
              </article>

              {/* Secondary stack — 2/5 ≈ 40% with vertical divider */}
              <div className="lg:col-span-2 lg:border-l lg:border-white/15 lg:pl-10">
                <div className="flex flex-col divide-y divide-white/10">
                  {[second, third].filter(Boolean).map((s) => (
                    <article key={s.id} className="py-6 first:pt-0 last:pb-0">
                      {s.category && (
                        <Link
                          to="/category/$slug"
                          params={{ slug: s.category.slug }}
                          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--category)] hover:text-white"
                        >
                          {s.category.name}
                        </Link>
                      )}
                      <Link to="/article/$slug" params={{ slug: s.slug }}>
                        <h2 className="font-display mt-2 text-xl leading-[1.15] text-white transition hover:text-[color:var(--brand-soft)] sm:text-2xl">
                          {s.title}
                        </h2>
                      </Link>
                      <div className="mt-2 flex items-center gap-2 text-xs text-white/55">
                        {s.author?.name && <span>{s.author.name}</span>}
                        {s.author?.name && <span aria-hidden>·</span>}
                        <time>
                          {formatDistanceToNow(new Date(s.published_at ?? s.created_at), { addSuffix: true })}
                        </time>
                        <span aria-hidden>·</span>
                        <span>{s.read_time} min</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-navy py-24 text-center text-navy-foreground">
            <div className="mx-auto max-w-2xl px-4">
              <h1 className="font-display text-4xl text-white sm:text-5xl">Everything AI. Nothing Else.</h1>
              <p className="mt-4 text-white/70">First articles publishing soon.</p>
            </div>
          </section>
        )}

        {/* Cognarah at a Glance */}
        <section className="mx-auto max-w-7xl bg-white px-4 py-6 sm:px-6 sm:py-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Cognarah at a Glance
          </h2>
          <ol className="divide-y divide-border">
            {[
              { num: 1, entity: "OpenAI", rest: "'s new reasoning model can now plan and execute multi-step tasks autonomously." },
              { num: 2, entity: "Anthropic", rest: " crosses a $150B valuation in its latest secondary sale." },
              { num: 3, entity: "EU AI Act", rest: " enforcement begins, raising the stakes for builders." },
              { num: 4, entity: "Lagos startup", rest: " raises $12M to bring multilingual AI to West Africa." },
              { num: 5, entity: "Nvidia", rest: " posts another blowout quarter as AI capex keeps climbing." },
              { num: 6, entity: "Coding tools ranked", rest: ": the best AI assistants for developers in 2026." },
            ].map((item) => (
              <li key={item.num} className="flex items-baseline gap-3 py-2">
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{
                    color: item.num === 4 ? "var(--africa)" : "var(--brand)",
                  }}
                >
                  {item.num}
                </span>
                <Link to="/search" className="text-sm text-foreground hover:text-[color:var(--brand)]">
                  <strong className="font-semibold">{item.entity}</strong>
                  {item.rest}
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* Africa AI Spotlight band — deep plum, full-width, 60px breathing room above */}
        {africa && (
          <section
            className="mt-8 border-y border-white/5 sm:mt-[60px]"
            style={{ backgroundColor: "var(--africa-surface)" }}
          >
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:py-20">
              <div className="lg:col-span-5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: "var(--africa)" }}
                  />
                  <span
                    className="font-display text-[11px] uppercase tracking-[0.28em]"
                    style={{ color: "var(--africa)" }}
                  >
                    Africa AI Spotlight
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Dispatches on the founders, funding, policy, and research building artificial intelligence across the African continent.
                </p>
              </div>
              <article className="lg:col-span-7">
                <Link
                  to="/article/$slug"
                  params={{ slug: africa.slug }}
                  className="block overflow-hidden rounded-md"
                >
                  {africa.hero_image && (
                    <img
                      src={mediaUrl(africa.hero_image)}
                      alt={africa.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  )}
                </Link>
                <Link to="/article/$slug" params={{ slug: africa.slug }}>
                  <h2
                    className="font-display mt-6 text-2xl leading-[1.1] text-white transition hover:opacity-90 sm:text-3xl lg:text-4xl"
                  >
                    {africa.title}
                  </h2>
                </Link>
                {africa.excerpt && (
                  <p className="mt-3 text-base text-white/70">{africa.excerpt}</p>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs text-white/55">
                  {africa.author?.name && <span>{africa.author.name}</span>}
                  {africa.author?.name && <span aria-hidden>·</span>}
                  <time>
                    {formatDistanceToNow(new Date(africa.published_at ?? africa.created_at), { addSuffix: true })}
                  </time>
                </div>
              </article>
            </div>
          </section>
        )}

        {/* Latest — compact three-column dense list */}
        {latest.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
              <h2 className="font-display text-xl uppercase tracking-wider">Latest</h2>
              <Link to="/search" className="text-sm font-medium text-[color:var(--brand)] hover:underline">
                All articles →
              </Link>
            </div>
            <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {latest.map((a: Article) => (
                <ArticleCard key={a.id} article={a} size="sm" />
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
