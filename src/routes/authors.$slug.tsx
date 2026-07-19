import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import { Pagination } from "@/components/site/pagination";
import { PAGE_SIZE_LIST, getRange, totalPages as calcTotalPages } from "@/lib/pagination";
import type { Article, Author } from "@/lib/types";
import { SITE_URL } from "@/lib/types";

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
});

async function loadAuthor(
  slug: string,
  page: number,
): Promise<{ author: Author; articles: Article[]; page: number; totalPages: number }> {
  const { data: author } = await supabase
    .from("authors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!author) throw notFound();
  const au = author as unknown as Author;
  const safePage = Math.max(1, page);
  const { from, to } = getRange(safePage, PAGE_SIZE_LIST);
  const { data: articles, count } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)", { count: "exact" })
    .eq("status", "published")
    .eq("author_id", au.id)
    .order("published_at", { ascending: false })
    .range(from, to);
  const totalPages = calcTotalPages(count, PAGE_SIZE_LIST);
  if (safePage > totalPages && (count ?? 0) > 0) throw notFound();
  return {
    author: au,
    articles: (articles ?? []) as unknown as Article[],
    page: safePage,
    totalPages,
  };
}

export const Route = createFileRoute("/authors/$slug")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ params, deps }) => loadAuthor(params.slug, deps.page),
  head: ({ params, loaderData }) => {
    const au = loaderData?.author;
    const page = loaderData?.page ?? 1;
    const total = loaderData?.totalPages ?? 1;
    const baseTitle = au ? `${au.name}: Author on Cognarah` : "Author: Cognarah";
    const baseDesc =
      au?.bio || `Articles by ${au?.name ?? ""} on Cognarah — AI news, startups, funding, tools and analysis.`;
    const title = page > 1 ? `${baseTitle} — Page ${page}` : baseTitle;
    const desc = page > 1 ? `Page ${page} of ${total}. ${baseDesc}` : baseDesc;
    const baseUrl = `${SITE_URL}/authors/${params.slug}`;
    const url = page > 1 ? `${baseUrl}?page=${page}` : baseUrl;
    const sameAs = [au?.twitter, au?.linkedin, au?.website].filter(Boolean) as string[];
    const links: { rel: string; href: string }[] = [{ rel: "canonical", href: url }];
    if (page > 1) {
      links.push({
        rel: "prev",
        href: page - 1 === 1 ? baseUrl : `${baseUrl}?page=${page - 1}`,
      });
    }
    if (page < total) {
      links.push({ rel: "next", href: `${baseUrl}?page=${page + 1}` });
    }
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        ...(au?.photo_url ? [
          { property: "og:image", content: au.photo_url },
          { name: "twitter:image", content: au.photo_url },
          { name: "twitter:card", content: "summary" },
        ] : []),
      ],
      links,
      scripts: au && page === 1 ? [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: au.name,
            description: au.bio || undefined,
            image: au.photo_url || undefined,
            url: baseUrl,
            sameAs: sameAs.length ? sameAs : undefined,
            worksFor: { "@type": "Organization", name: "Cognarah", url: SITE_URL },
          }),
        },
      ] : undefined,
    };
  },
  component: AuthorPage,
  errorComponent: ({ error }) => <div className="p-8">Error: {error.message}</div>,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Author not found</h1>
        <Link to="/" className="mt-4 inline-block text-brand">← Back home</Link>
      </div>
    </div>
  ),
});

function AuthorPage() {
  const { author, articles, page, totalPages } = Route.useLoaderData();
  const buildHref = (p: number) =>
    p === 1 ? `/authors/${author.slug}` : `/authors/${author.slug}?page=${p}`;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-10 text-navy-foreground sm:py-16">
          <div className="mx-auto flex max-w-5xl flex-wrap items-start gap-6 px-4 sm:px-6">
            {author.photo_url && (
              <img
                src={author.photo_url}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-2 ring-white/20"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Author</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{author.name}</h1>
              {author.bio && (
                <p className="mt-4 max-w-2xl text-base text-white/80 sm:text-lg">{author.bio}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {author.website && <a href={author.website} target="_blank" rel="noopener noreferrer" className="text-white/80 underline hover:text-white">Website</a>}
                {author.twitter && <a href={author.twitter} target="_blank" rel="noopener noreferrer" className="text-white/80 underline hover:text-white">Twitter</a>}
                {author.linkedin && <a href={author.linkedin} target="_blank" rel="noopener noreferrer" className="text-white/80 underline hover:text-white">LinkedIn</a>}
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
          <h2 className="mb-8 text-2xl font-bold">Articles by {author.name}</h2>
          {articles.length === 0 ? (
            <p className="text-muted-foreground">No published articles yet.</p>
          ) : (
            <>
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                {articles.map((a: Article) => <ArticleCard key={a.id} article={a} />)}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} buildHref={buildHref} />
            </>
          )}
        </section>
        <NewsletterSignup />
      </main>
      <SiteFooter />
    </div>
  );
}
