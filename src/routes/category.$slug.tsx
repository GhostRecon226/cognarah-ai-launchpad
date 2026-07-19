import { createFileRoute, notFound } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import { Pagination } from "@/components/site/pagination";
import { PAGE_SIZE_LIST, getRange, totalPages as calcTotalPages } from "@/lib/pagination";
import type { Article, Category } from "@/lib/types";
import { SITE_URL } from "@/lib/types";

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
});

async function loadCategory(
  slug: string,
  page: number,
): Promise<{ category: Category; articles: Article[]; page: number; totalPages: number }> {
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!category) throw notFound();
  const c = category as unknown as Category;
  const safePage = Math.max(1, page);
  const { from, to } = getRange(safePage, PAGE_SIZE_LIST);
  const { data: articles, count } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)", { count: "exact" })
    .eq("status", "published")
    .eq("category_id", c.id)
    .order("published_at", { ascending: false })
    .range(from, to);
  const totalPages = calcTotalPages(count, PAGE_SIZE_LIST);
  if (safePage > totalPages && (count ?? 0) > 0) throw notFound();
  return {
    category: c,
    articles: (articles ?? []) as unknown as Article[],
    page: safePage,
    totalPages,
  };
}

export const Route = createFileRoute("/category/$slug")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ params, deps }) => loadCategory(params.slug, deps.page),
  head: ({ params, loaderData }) => {
    const c = loaderData?.category;
    const page = loaderData?.page ?? 1;
    const total = loaderData?.totalPages ?? 1;
    const baseTitle = c ? `${c.name}: Cognarah` : "Category: Cognarah";
    const baseDesc = c?.description || `Latest ${c?.name ?? ""} coverage on Cognarah.`;
    const title = page > 1 ? `${baseTitle} — Page ${page}` : baseTitle;
    const desc = page > 1 ? `Page ${page} of ${total}. ${baseDesc}` : baseDesc;
    const baseUrl = `${SITE_URL}/category/${params.slug}`;
    const url = page > 1 ? `${baseUrl}?page=${page}` : baseUrl;
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
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links,
    };
  },
  component: CategoryPage,
  errorComponent: ({ error }) => <div className="p-8">Error: {error.message}</div>,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Category not found</h1>
    </div>
  ),
});

function CategoryPage() {
  const { category, articles, page, totalPages } = Route.useLoaderData();
  const buildHref = (p: number) =>
    p === 1 ? `/category/${category.slug}` : `/category/${category.slug}?page=${p}`;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-10 text-navy-foreground sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: category.color ?? undefined }}>
              Category
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{category.name}</h1>
            {category.description && <p className="mt-4 max-w-2xl text-base text-white/70 sm:text-lg">{category.description}</p>}
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
          {category.long_intro && page === 1 && (
            <div
              className="prose-article mx-auto mb-12 max-w-3xl"
              dangerouslySetInnerHTML={{ __html: category.long_intro }}
            />
          )}
          {articles.length === 0 ? (
            <p className="text-muted-foreground">No articles yet in this category.</p>
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
