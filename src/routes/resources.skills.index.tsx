import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/types";
import { cn } from "@/lib/utils";

type Skill = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
};

const skillsQuery = queryOptions({
  queryKey: ["skills", "published"],
  queryFn: async (): Promise<Skill[]> => {
    const { data, error } = await supabase
      .from("skills")
      .select("id, slug, title, description, category, difficulty")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Skill[];
  },
});

export const Route = createFileRoute("/resources/skills/")({
  head: () => ({
    meta: [
      { title: "Skills: Cognarah" },
      { name: "description", content: "Practical AI skills, prompts, and workflows curated by Cognarah." },
      { property: "og:title", content: "Skills: Cognarah" },
      { property: "og:description", content: "Practical AI skills, prompts, and workflows." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/resources/skills` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/resources/skills` }],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(skillsQuery);
  },
  component: SkillsPage,
});

const CATEGORIES = ["All", "Claude Code", "Prompt Engineering", "Automation", "Workflow", "Other"];
const DIFFICULTIES = ["All", "Beginner", "Intermediate", "Advanced"];

function SkillsPage() {
  const { data: skills } = useSuspenseQuery(skillsQuery);
  const [category, setCategory] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      skills.filter(
        (s) =>
          (category === "All" || s.category === category) &&
          (difficulty === "All" || s.difficulty === difficulty) &&
          (normalizedQuery === "" ||
            s.title.toLowerCase().includes(normalizedQuery) ||
            s.description.toLowerCase().includes(normalizedQuery)),
      ),
    [skills, category, difficulty, normalizedQuery],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-12 text-navy-foreground sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Resources</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Skills</h1>
            <p className="mt-4 max-w-2xl text-base text-white/75 sm:text-lg">
              Practical AI skills, prompts, and workflows to help you ship faster. Curated by the Cognarah team.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <FilterGroup label="Category" value={category} options={CATEGORIES} onChange={setCategory} />
            <FilterGroup label="Level" value={difficulty} options={DIFFICULTIES} onChange={setDifficulty} />
          </div>

          <div className="mb-8">
            <label htmlFor="skill-search" className="sr-only">
              Search skills
            </label>
            <input
              id="skill-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills by title or description"
              className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-border bg-secondary p-8 text-center text-muted-foreground">
              No skills yet. Check back soon.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <article
                  key={s.id}
                  className="group flex flex-col rounded-lg border border-border bg-background p-5 transition hover:border-brand hover:shadow-md"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                      {s.category}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {s.difficulty}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold leading-tight text-foreground group-hover:text-brand">
                    {s.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
                  <Link
                    to="/resources/skills/$slug"
                    params={{ slug: s.slug }}
                    className="mt-4 inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-navy transition hover:bg-brand/90"
                  >
                    Get Skill
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <NewsletterSignup />
      </main>
      <SiteFooter />
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}:</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            value === o
              ? "border-brand bg-brand text-navy"
              : "border-border bg-background text-muted-foreground hover:border-brand hover:text-brand",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
