import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import { sanitizeHtml } from "@/lib/sanitize";
import type { Article } from "@/lib/types";
import { SITE_URL } from "@/lib/types";
import { format } from "date-fns";
import { Twitter, Linkedin, Facebook, MessageCircle } from "lucide-react";

async function loadArticle(slug: string): Promise<{ article: Article; related: Article[] }> {
  const { data: article } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!article) throw notFound();
  const a = article as unknown as Article;
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
        { title: `${title} — Cognarah` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(a?.hero_image ? [
          { property: "og:image", content: a.hero_image },
          { name: "twitter:image", content: a.hero_image },
          { name: "twitter:card", content: "summary_large_image" },
        ] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: a ? [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          image: a.hero_image ? [a.hero_image] : undefined,
          datePublished: a.published_at,
          author: a.author ? { "@type": "Person", name: a.author.name } : undefined,
          publisher: { "@type": "Organization", name: "Cognarah" },
        }),
      }] : undefined,
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
  const enc = encodeURIComponent;
  const shareTitle = enc(article.title);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
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
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{article.title}</h1>
          {article.excerpt && <p className="mt-4 text-xl text-muted-foreground">{article.excerpt}</p>}
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
            <img
              src={article.hero_image}
              alt={article.title}
              className="mt-8 aspect-[16/9] w-full rounded-xl object-cover"
            />
          )}
          <div
            className="prose-article mt-10"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body) }}
          />

          {/* Share */}
          <div className="mt-12 flex items-center gap-3 border-t pt-6">
            <span className="text-sm font-semibold">Share:</span>
            <a aria-label="Share on X" href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${shareTitle}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-secondary p-2 hover:bg-navy hover:text-white"><Twitter className="h-4 w-4" /></a>
            <a aria-label="Share on LinkedIn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-secondary p-2 hover:bg-navy hover:text-white"><Linkedin className="h-4 w-4" /></a>
            <a aria-label="Share on Facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-secondary p-2 hover:bg-navy hover:text-white"><Facebook className="h-4 w-4" /></a>
            <a aria-label="Share on WhatsApp" href={`https://wa.me/?text=${shareTitle}%20${enc(url)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-secondary p-2 hover:bg-navy hover:text-white"><MessageCircle className="h-4 w-4" /></a>
          </div>
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
