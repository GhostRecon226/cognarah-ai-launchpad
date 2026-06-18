import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { ArticleCard } from "@/components/site/article-card";
import type { Article, Category } from "@/lib/types";
import { SITE_URL } from "@/lib/types";

async function loadCategory(slug: string): Promise<{ category: Category; articles: Article[] }> {
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!category) throw notFound();
  const c = category as unknown as Category;
  const { data: articles } = await supabase
    .from("articles")
    .select("*, author:authors(*), category:categories(*)")
    .eq("status", "published")
    .eq("category_id", c.id)
    .order("published_at", { ascending: false });
  return { category: c, articles: (articles ?? []) as unknown as Article[] };
}

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => loadCategory(params.slug),
  head: ({ params, loaderData }) => {
    const c = loaderData?.category;
    const title = c ? `${c.name} — Cognarah` : "Category — Cognarah";
    const desc = c?.description || `Latest ${c?.name ?? ""} coverage on Cognarah.`;
    const url = `${SITE_URL}/category/${params.slug}`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
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
  const { category, articles } = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-16 text-navy-foreground">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: category.color ?? undefined }}>
              Category
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{category.name}</h1>
            {category.description && <p className="mt-4 max-w-2xl text-lg text-white/70">{category.description}</p>}
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          {articles.length === 0 ? (
            <p className="text-muted-foreground">No articles yet in this category.</p>
          ) : (
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </section>
        <NewsletterSignup />
      </main>
      <SiteFooter />
    </div>
  );
}
