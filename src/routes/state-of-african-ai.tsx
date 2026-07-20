import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterSignup } from "@/components/site/newsletter";
import { SITE_URL } from "@/lib/types";

const TITLE = "The State of African AI: 2026 Guide to Startups, Funding & Policy";
const DESC =
  "Cognarah's flagship reference on African AI: the startups shipping, the funding rounds closing, the research hubs producing talent, and the policy shaping how the continent builds AI.";
const URL = `${SITE_URL}/state-of-african-ai`;
const HERO_IMAGE = `${SITE_URL}/__l5e/assets-v1/1ba8d09a-14df-43f5-b409-61947d7ccfba/cognarah-logo.png`;

const FAQS: { q: string; a: string }[] = [
  {
    q: "Which African countries lead in AI right now?",
    a: "South Africa, Nigeria, Kenya, Egypt, and Rwanda hold the deepest concentrations of AI talent, funded startups, and government AI strategies as of 2026.",
  },
  {
    q: "How much AI funding has flowed into Africa?",
    a: "African AI startups have raised more than one billion US dollars in disclosed rounds across 2023 to 2026, with the majority concentrated in fintech-adjacent AI, agri-AI, and language models for African languages.",
  },
  {
    q: "What are the biggest African AI startups?",
    a: "Lelapa AI, InstaDeep (acquired by BioNTech), Kudi, Aerobotics, Envisionit Deep AI, and Awarri are among the most-cited African AI startups, alongside a fast-growing cohort of Lagos and Nairobi builders.",
  },
  {
    q: "Is there an African AI regulatory framework?",
    a: "The African Union adopted a Continental AI Strategy in 2024, and individual states including Rwanda, Egypt, Kenya, and Nigeria have published national AI strategies. Implementation and enforcement remain uneven.",
  },
];

export const Route = createFileRoute("/state-of-african-ai")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: HERO_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: HERO_IMAGE },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESC,
          image: [HERO_IMAGE],
          author: { "@type": "Organization", name: "Cognarah", url: SITE_URL },
          publisher: {
            "@type": "Organization",
            name: "Cognarah",
            logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.png` },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": URL },
          about: [
            { "@type": "Thing", name: "African AI" },
            { "@type": "Thing", name: "AI Startups" },
            { "@type": "Thing", name: "AI Funding" },
            { "@type": "Thing", name: "AI Policy" },
          ],
          inLanguage: "en",
          speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1", "#tldr"] },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "State of African AI", item: URL },
          ],
        }),
      },
    ],
  }),
  component: Pillar,
});

function Pillar() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <header className="bg-navy py-14 text-navy-foreground sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--brand-soft)]">
              Pillar guide
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {TITLE}
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-white/80 sm:text-xl">{DESC}</p>
          </div>
        </header>

        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 prose-article">
          <section id="tldr">
            <h2>The short version</h2>
            <p>
              African AI in 2026 is no longer a promise, it is a working ecosystem. More than one
              billion US dollars in disclosed funding has flowed into African AI startups since
              2023. Lagos, Nairobi, Cape Town, Cairo, and Kigali now host companies shipping
              production AI in fintech, agriculture, healthcare, and low-resource language
              modeling. The African Union has a continental AI strategy, and at least four states
              have national ones. This guide is Cognarah's reference for what exists, who is
              building it, and where the gaps still are.
            </p>
          </section>

          <h2>Hubs and where the talent is</h2>
          <p>
            Five cities do most of the visible work. Lagos and Nairobi lead on applied AI in
            fintech and consumer products. Cape Town and Johannesburg anchor research and
            enterprise AI, driven by university pipelines and Naspers-linked capital. Cairo has
            deep computer-vision and Arabic-language talent. Kigali is the policy laboratory,
            hosting the Global AI Summit on Africa and shaping cross-border rules.
          </p>

          <h2>Startups to know</h2>
          <p>
            Lelapa AI is building language models for African languages. InstaDeep, founded in
            Tunis and now part of BioNTech, remains the continent's most consequential AI exit.
            Aerobotics uses computer vision for agriculture. Envisionit Deep AI applies AI to
            medical imaging. Awarri is training Nigerian-language LLMs. Kudi and a wave of
            fintech companies embed AI in credit scoring and fraud detection.
          </p>

          <h2>Funding: what the last three years look like</h2>
          <p>
            Round sizes cluster in two bands, seed rounds of 500K to 3M US dollars, and Series A
            and B rounds of 8M to 30M. Global investors, Y Combinator, a16z, General Catalyst,
            and a growing set of African funds including Norrsken22, Partech Africa, and TLcom,
            now show up on cap tables regularly. Fintech-adjacent AI takes the largest share.
            Language and healthcare AI are the fastest growing categories by deal count.
          </p>

          <h2>Policy and governance</h2>
          <p>
            The African Union's Continental AI Strategy, adopted in 2024, sets the frame. Rwanda,
            Egypt, Kenya, Nigeria, and Mauritius have published national AI strategies. Data
            protection is patchier, Nigeria and South Africa have enforceable regimes, several
            others are still drafting. Enforcement lags publication in most jurisdictions.
          </p>

          <h2>Where the gaps still are</h2>
          <ul>
            <li>Compute. GPU capacity on the continent remains a fraction of demand.</li>
            <li>Data. Labeled datasets in African languages are still scarce.</li>
            <li>Late-stage capital. Rounds beyond Series B are rare.</li>
            <li>Public benchmarks. Very few African models publish comparable evaluations.</li>
          </ul>

          <h2>Frequently asked</h2>
          {FAQS.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}

          <hr />
          <p>
            This guide is a living reference. Cognarah updates it as new funding rounds close,
            new policy is published, and new startups ship. For continuous coverage, see the{" "}
            <a href="/category/africa-ai">Africa AI category</a> and the{" "}
            <a href="/category/funding">Funding category</a>.
          </p>
        </article>

        <NewsletterSignup />
      </main>
      <SiteFooter />
    </div>
  );
}
