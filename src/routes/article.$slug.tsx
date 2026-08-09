import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import { sanitizeHtml } from "@/lib/sanitize";
import { mediaUrl } from "@/lib/media-url";
import { MediaImage } from "@/components/site/media-image";
import type { Article } from "@/lib/types";
import { SITE_URL } from "@/lib/types";
import { format } from "date-fns";
import { ArticleShare } from "@/components/site/article-share";
import { AdUnit } from "@/components/site/ad-unit";
import { ViewTracker } from "@/components/site/view-tracker";
import { AD_SLOTS } from "@/lib/adsense";

function splitBodyAfterSecondParagraph(html: string): [string, string] {
  const re = /<\/p>/gi;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = re.exec(html)) !== null) {
    count += 1;
    if (count === 2) {
      const idx = match.index + match[0].length;
      return [html.slice(0, idx), html.slice(idx)];
    }
  }
  return [html, ""];
}

async function loadArticle(slug: string): Promise<{ article: Article; related: Article[] }> {
  const { data: article } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!article) throw notFound();
  const a = article as unknown as Article;
  try { await supabase.rpc("increment_article_views", { _slug: slug }); } catch (e) { console.warn("[views] increment failed", e); }
  let related: Article[] = [];
  if (a.category_id) {
    const { data } = await supabase
      .from("articles")
      .select("*, author:authors(*), category:categories(*)")
      .eq("status", "published")
      .eq("category_id", a.category_id)
      .neq("id", a.id)
      .order("published_at", { ascending: false })
      .limit(3);
    related = (data ?? []) as unknown as Article[];
  }
  return { article: a, related };
}

export const Route = createFileRoute("/article/$slug")({
  loader: ({ params }) => loadArticle(params.slug),
  head: ({ params, loaderData }) => {
    const a = loaderData?.article;
    const title = a?.seo_title || a?.title || "Article";
    const desc = a?.meta_description || a?.excerpt || "";
    const url = `${SITE_URL}/article/${params.slug}`;
    return {
      meta: [
        { title: `${title}: Cognarah` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(a?.hero_image ? [
          { property: "og:image", content: mediaUrl(a.hero_image, SITE_URL) },
          { name: "twitter:image", content: mediaUrl(a.hero_image, SITE_URL) },
          { name: "twitter:card", content: "summary_large_image" },
        ] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: a ? [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": a.is_news === false ? "Article" : "NewsArticle",
            headline: a.title,
            description: a.meta_description || a.excerpt || undefined,
            image: a.hero_image ? [mediaUrl(a.hero_image, SITE_URL)] : undefined,
            datePublished: a.published_at,
            dateModified: a.updated_at,
            author: a.author ? {
              "@type": "Person",
              name: a.author.name,
              url: `${SITE_URL}/authors/${a.author.slug}`,
              sameAs: [a.author.twitter, a.author.linkedin, a.author.website].filter(Boolean),
            } : undefined,
            publisher: {
              "@type": "Organization",
              name: "Cognarah",
              logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.png` },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            articleSection: a.category?.name,
            keywords: (a.tags ?? []).join(", ") || undefined,
            about: (a.tags ?? []).map((t) => ({ "@type": "Thing", name: t })),
            wordCount: a.body ? a.body.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length : undefined,
            articleBody: a.body ? a.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000) : undefined,
            speakable: {
              "@type": "SpeakableSpecification",
              cssSelector: ["h1", ".prose-article p:first-of-type"],
            },
            inLanguage: "en",
          }),
        },

        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              ...(a.category ? [{ "@type": "ListItem", position: 2, name: a.category.name, item: `${SITE_URL}/category/${a.category.slug}` }] : []),
              { "@type": "ListItem", position: a.category ? 3 : 2, name: a.title, item: url },
            ],
          }),
        },
      ] : undefined,
    };
  },
  component: ArticlePage,
  errorComponent: ({ error }) => <div className="p-8">Error: {error.message}</div>,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Article not found</h1>
        <Link to="/" className="mt-4 inline-block text-brand">← Back home</Link>
      </div>
    </div>
  ),
});

function ArticlePage() {
  const { article, related } = Route.useLoaderData();
  const url = `${SITE_URL}/article/${article.slug}`;
  return (
    <div className="flex min-h-screen flex-col">
      <ViewTracker slug={article.slug} />
      <SiteNav />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
          {article.category && (
            <Link
              to="/category/$slug"
              params={{ slug: article.category.slug }}
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: article.category.color ?? undefined }}
            >
              {article.category.name}
            </Link>
          )}
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{article.title}</h1>
          {article.excerpt && <p className="mt-4 text-lg text-muted-foreground sm:text-xl">{article.excerpt}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {article.author?.name && <span className="font-medium text-foreground">{article.author.name}</span>}
            {article.published_at && (
              <>
                <span aria-hidden>·</span>
                <time>{format(new Date(article.published_at), "MMM d, yyyy")}</time>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{article.read_time} min read</span>
          </div>
          {article.hero_image && (
            <MediaImage
              src={article.hero_image}
              alt={article.title}
              className="mt-8 aspect-[16/9] w-full rounded-xl object-cover"
              fallbackClassName="mt-8 aspect-[16/9] w-full rounded-xl"
            />
          )}
          {article.key_takeaways && article.key_takeaways.length > 0 && (
            <aside
              aria-label="Key takeaways"
              className="mt-8 rounded-xl border border-border bg-secondary/50 p-5 sm:p-6"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-brand">
                Key takeaways
              </h2>
              <ul className="mt-3 space-y-2 text-base leading-relaxed">
                {article.key_takeaways.map((k: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          {(() => {
            const [firstPart, restPart] = splitBodyAfterSecondParagraph(sanitizeHtml(article.body));
            return (
              <>
                <div
                  className="prose-article mt-10"
                  dangerouslySetInnerHTML={{ __html: firstPart }}
                />
                {restPart && (
                  <>
                    <AdUnit position="in-article" slot={AD_SLOTS.inArticleTop} />
                    <div
                      className="prose-article"
                      dangerouslySetInnerHTML={{ __html: restPart }}
                    />
                  </>
                )}
              </>
            );
          })()}
          <AdUnit position="in-article" slot={AD_SLOTS.inArticleBottom} />
          {article.author && (
            <section className="mt-12 rounded-xl border border-border bg-background p-5 sm:p-6">
              <div className="flex flex-wrap items-start gap-4">
                {article.author.photo_url && (
                  <img
                    src={article.author.photo_url}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Written by
                  </p>
                  <Link
                    to="/authors/$slug"
                    params={{ slug: article.author.slug }}
                    className="mt-1 block text-lg font-semibold hover:text-brand"
                  >
                    {article.author.name}
                  </Link>
                  {article.author.bio && (
                    <p className="mt-2 text-sm text-muted-foreground">{article.author.bio}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          <ArticleShare url={url} title={article.title} />
        </article>

        {related.length > 0 && (
          <section className="border-t bg-secondary">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
              <h2 className="mb-8 text-2xl font-bold">Related articles</h2>
              <div className="grid gap-10 md:grid-cols-3">
                {related.map((a: Article) => <ArticleCard key={a.id} article={a} />)}
              </div>
            </div>
          </section>
        )}

        <NewsletterSignup variant="dark" />
      </main>
      <SiteFooter />
    </div>
  );
}
