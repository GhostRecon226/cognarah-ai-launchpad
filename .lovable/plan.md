
# Cognarah SEO & GEO Audit

Source: Semrush (US database), live site fetch of cognarah.com, current route/head code, robots.txt, sitemap.xml, llms.txt, SEO scan findings.

## 1. Current state (verified)

**Search visibility (Semrush)**
- Organic keywords indexed: **1** (US/UK/PH) — ranking pos 85 for the misspelling "conrah". Estimated traffic: 0/mo.
- Authority Score: **2/100**, Trust: **2/100**.
- Backlinks: 30 from 18 referring domains — **almost entirely spam** (Fiverr/PBN "SEO services" domains, 23 of 30 nofollow). This is a toxic profile, not an asset.
- No competitor set auto-discovered (site too new/small to match).

**Technical SEO (good — largely in place)**
- SSR renders full meta, canonical, OG, Twitter, JSON-LD on home/article/author/category/skills. Verified via curl.
- `/robots.txt` correct, allows crawl, blocks `/admin` + `/auth`, points to sitemap.
- `/sitemap.xml` dynamic, includes static pages, all 11 categories, published articles + authors + skills with `lastmod`.
- Article routes emit `NewsArticle` + `BreadcrumbList` JSON-LD; root emits `Organization` + `WebSite` with SearchAction.
- Google Site Verification meta present; AdSense account meta present.

**GEO / AI-search readiness**
- `/llms.txt` exists and is well-structured (home, about, categories linked).
- Site is missing several GEO signals: no `Article` JSON-LD `about`/`mentions`, no author `sameAs` in structured data on articles, no FAQ blocks, no `speakable` schema, llms.txt doesn't link individual high-value articles, no `/llms-full.txt`.

**Accessibility (from scan)**
- Low-contrast text somewhere (likely `text-muted-foreground` on dark card or placeholder). Affects Lighthouse and, indirectly, Core Web Vitals scoring perception.

**Content gap**
- Semrush suggests a flagship "State of African AI" guide: keyword "african ai" = **4,400/mo, KD 36** — realistically winnable for the site's niche, and no competition tracked.

## 2. Diagnosis

The technical foundation is solid. Growth is blocked by three things, in order of impact:

1. **No content depth yet** — 1 indexed keyword means Google has crawled the site but hasn't found enough distinctive, linked content to rank. Category pages and articles exist, but there are no evergreen "pillar" pages targeting the site's actual sweet spot (Africa AI, AI funding rounds, AI tools directories).
2. **Toxic backlink profile** — every referring domain is a spam/PBN farm. Left alone this suppresses trust and can trigger manual review as volume grows.
3. **Small GEO gaps** — llms.txt is thin; article JSON-LD is missing `about`/`mentions`/`sameAs` that LLM crawlers (ChatGPT, Perplexity, Google AI Overviews) use to attribute quotes and cite Cognarah.

## 3. Recommended plan (build phase, in priority order)

### P0 — Content foundation (biggest lever)
- **Pillar page: "The State of African AI: 2026 Guide"** targeting `african ai` (4.4K/mo, KD 36). Long-form (2,500+ words), original data table of top African AI startups, funding totals, research hubs. Internally link every existing Africa AI article to it and vice versa.
- **Category intro copy**: expand `long_intro` on the 11 category pages (currently mostly empty) to 200–300 words each — targets long-tail like "ai funding rounds", "ai tools 2026", "generative ai africa".
- **Weekly "AI funding this week" recap** — evergreen slug pattern that accumulates authority for funding queries.

### P1 — GEO / AI-search enhancements
- Extend article `NewsArticle` JSON-LD with `about` (topic entities), `mentions` (companies/people), and author `sameAs` (twitter/linkedin/website already in DB).
- Add a **FAQPage JSON-LD** block on the pillar and on categories that have `long_intro`.
- Expand `/llms.txt` to link top 20 articles + skills, and add a `/llms-full.txt` that concatenates article summaries (LLM crawlers prefer this).
- Add `speakable` schema to article headline/summary for voice/AI assistant surfacing.
- Add per-article `wordCount` and `articleBody` to JSON-LD.

### P2 — Trust / backlinks
- **Disavow file**: generate `disavow.txt` for the 18 spam referring domains and document the manual upload to GSC (agent can't upload, but can produce the file and instructions).
- Add outbound `sameAs` on the Organization schema (LinkedIn, YouTube, GitHub if any) once accounts exist.
- Submit sitemap to Bing Webmaster Tools (currently only GSC is verified).

### P3 — Cleanup
- Fix the Lighthouse contrast finding (audit muted-foreground usage on dark surfaces, replace arbitrary greys with tokens).
- Add `og:image` fallback to non-article routes that lack one (home, about, categories) — a single branded 1200x630 works.
- Add `<h1>` audit pass on category/skills routes to confirm one-per-page.

## 4. What I won't do without approval
- Won't touch the backlink profile beyond producing the disavow file.
- Won't publish AI-generated pillar content — the "State of African AI" page should be human-edited after Gemini/Claude drafts it, given its strategic weight.

## 5. Expected outcome (6–12 weeks post-P0+P1)
- Indexed keywords: 1 → ~150–400 (based on 15+ articles + expanded category pages + pillar).
- Authority Score: 2 → 8–15 as legitimate links accrue and spam is disavowed.
- First AI-Overview / Perplexity citations become plausible once GEO tags ship and the pillar exists.

---

**Next step**: approve this plan and I'll execute P0 + P1 first (pillar page scaffolding, category intros, JSON-LD extensions, llms.txt expansion, disavow file). P2/P3 in a follow-up.
