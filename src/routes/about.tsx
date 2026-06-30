import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { NAV_CATEGORIES } from "@/components/site/nav";
import { SITE_URL } from "@/lib/types";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Cognarah" },
      { name: "description", content: "Cognarah is the definitive media platform for everything artificial intelligence." },
      { property: "og:title", content: "About — Cognarah" },
      { property: "og:description", content: "Cognarah is the definitive media platform for everything AI." },
      { property: "og:url", content: `${SITE_URL}/about` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/about` }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="bg-navy py-12 text-navy-foreground sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">About</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">About Cognarah</h1>
            <p className="mt-6 text-base text-white/75 sm:text-lg">
              Cognarah is a media platform built exclusively around artificial intelligence. We cover the people, products, capital, policy, and culture shaping the most consequential technology of our era.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
          <h2 className="text-2xl font-bold">Our mission</h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            To be the definitive media platform for everything artificial intelligence — with a global lens, an editorial backbone, and a deliberate focus on the regions and voices the rest of the AI press is missing, especially Africa.
          </p>
          <h2 className="mt-12 text-2xl font-bold">What we cover</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {NAV_CATEGORIES.map((c) => (
              <li key={c.slug} className="rounded-md border border-border bg-secondary px-4 py-3 font-medium">
                {c.name}
              </li>
            ))}
          </ul>
          <h2 className="mt-12 text-2xl font-bold">Contact</h2>
          <p className="mt-4 text-lg">
            Tips, pitches, partnerships: <a className="text-brand underline" href="mailto:hello@cognarah.com">hello@cognarah.com</a>
          </p>
        </section>
        <NewsletterSignup />
      </main>
      <SiteFooter />
    </div>
  );
}
