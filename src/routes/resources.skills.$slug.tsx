import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { marked } from "marked";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize";
import { SITE_URL } from "@/lib/types";
import { Download, ArrowLeft, ExternalLink, Sparkles, Github, Star, Clock, FileText } from "lucide-react";

type Skill = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  content: string;
  file_url: string | null;
  author: string;
  published: boolean;
  entry_type: "directory" | "original";
  source_url: string | null;
  stars_count: number | null;
  last_updated: string | null;
  bundled_files: string[] | null;
};

const skillQuery = (slug: string) =>
  queryOptions({
    queryKey: ["skills", "detail", slug],
    queryFn: async (): Promise<Skill> => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Skill;
    },
  });

export const Route = createFileRoute("/resources/skills/$slug")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(skillQuery(params.slug));
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Skill: Cognarah" }, { name: "robots", content: "noindex" }] };
    }
    const url = `${SITE_URL}/resources/skills/${params.slug}`;
    return {
      meta: [
        { title: `${(loaderData as any).title}: Cognarah` },
        { name: "description", content: (loaderData as any).description },
        { property: "og:title", content: (loaderData as any).title },
        { property: "og:description", content: (loaderData as any).description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SkillDetail,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Skill not found</h1>
        <Link to="/resources/skills" className="mt-4 inline-block text-brand underline">Back to Skills</Link>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
      </main>
      <SiteFooter />
    </div>
  ),
});

function SkillDetail() {
  const { slug } = Route.useParams();
  const { data: skill } = useSuspenseQuery(skillQuery(slug));
  const html = sanitizeHtml(marked.parse(skill.content, { async: false }) as string);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-10 text-navy-foreground sm:py-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Link
              to="/resources/skills"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-brand hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" /> All Skills
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                {skill.category}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
                {skill.difficulty}
              </span>
              {skill.entry_type === "original" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-navy">
                  <Sparkles className="h-3 w-3" /> Cognarah Original
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{skill.title}</h1>
            <p className="mt-3 text-base text-white/75 sm:text-lg">{skill.description}</p>
            <p className="mt-2 text-xs text-white/50">By {skill.author}</p>
            {skill.entry_type === "original" && skill.file_url && (
              <a
                href={`${skill.file_url}${skill.file_url.includes("?") ? "&" : "?"}download=1`}
                download
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3 text-base font-semibold text-navy shadow-lg shadow-brand/20 transition hover:bg-brand/90 sm:text-lg"
              >
                <Download className="h-5 w-5" /> Download Skill File
              </a>
            )}
            {skill.entry_type === "directory" && skill.source_url && (
              <a
                href={skill.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-6 py-3 text-base font-semibold text-navy shadow-lg shadow-brand/20 transition hover:bg-brand/90 sm:text-lg"
              >
                <ExternalLink className="h-5 w-5" /> Get Skill from Source
              </a>
            )}
          </div>
        </section>
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          {skill.entry_type === "directory" && skill.source_url && (() => {
            const url = skill.source_url;
            const ghMatch = url.match(/github\.com\/([^\/#?]+)\/([^\/#?]+)/i);
            const isGithub = !!ghMatch;
            const repoLabel = ghMatch ? `${ghMatch[1]}/${ghMatch[2].replace(/\.git$/i, "")}` : new URL(url).hostname;
            return (
              <aside className="mb-8 rounded-lg border border-border bg-secondary/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Source</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      By <span className="font-semibold">{skill.author}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      {isGithub && <Github className="h-4 w-4" aria-hidden="true" />}
                      <span className="break-all">{repoLabel}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {typeof skill.stars_count === "number" && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                          {skill.stars_count.toLocaleString()} stars
                        </span>
                      )}
                      {skill.last_updated && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          Updated {new Date(skill.last_updated).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
                  >
                    {isGithub ? <Github className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                    {isGithub ? "View GitHub Repository" : "View Source"}
                  </a>
                </div>
                {skill.bundled_files && skill.bundled_files.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Files in bundle</p>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {skill.bundled_files.map((f) => (
                        <li key={f} className="inline-flex items-center gap-2 text-sm text-foreground">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate font-mono text-xs">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            );
          })()}
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: html }} />
          {skill.entry_type === "original" && skill.file_url && (
            <div className="mt-10 rounded-lg border border-brand/30 bg-brand/5 p-6 text-center">
              <p className="text-sm font-medium text-foreground">Ready to use this skill?</p>
              <a
                href={`${skill.file_url}${skill.file_url.includes("?") ? "&" : "?"}download=1`}
                download
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-brand/90"
              >
                <Download className="h-4 w-4" /> Download Skill File
              </a>
            </div>
          )}
          {skill.entry_type === "directory" && skill.source_url && (
            <div className="mt-10 rounded-lg border border-brand/30 bg-brand/5 p-6 text-center">
              <p className="text-sm font-medium text-foreground">This skill lives at the original source.</p>
              <a
                href={skill.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-brand/90"
              >
                <ExternalLink className="h-4 w-4" /> Open Source Page
              </a>
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
