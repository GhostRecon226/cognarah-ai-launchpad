## How to Rank Cognarah on Google & AI Search Engines

Your site is brand-new (Semrush sees 1 keyword, no competitor data yet — normal). Ranking is a compounding game: technical foundation (done) → publishing cadence → topical authority → backlinks. Here's the concrete playbook.

### 1. Own your winnable niches first (biggest lever)

Don't chase "openai news" (KD 79) or "generative ai news" (KD 78) — big publishers dominate. Target keywords where your Africa AI focus is a moat:

| Keyword | Volume/mo | Difficulty | Play |
|---|---|---|---|
| african ai | 4,400 | 36 (possible) | Pillar guide + hub page |
| ai funding news | 3,600 | 40 (possible) | Weekly funding roundup format |
| best ai coding tools | 1,000 | 48 (possible) | Annual ranked list, keep fresh |
| ai policy | 2,400 | 54 (difficult) | Africa & EU policy angle |
| ai startups africa | low | 0 (easy) | Directory/leaderboard page |
| ai tools 2026 | 70 | 0 (easy) | Refresh yearly, low-hanging |

**Content shape**: one **pillar page** per theme (~2,000 words, evergreen, updated monthly) + **cluster articles** linking back to it. Example: `/guides/african-ai` as the pillar; every Africa AI news post links to it.

### 2. Publishing cadence (non-negotiable for news SEO)

- **3–5 posts/week minimum.** Google News/Discover rewards freshness and consistency.
- Every article: unique title + 120–160 char meta description + hero image + author byline + published date + at least 2 internal links.
- Roundups (weekly funding, weekly Africa AI dispatch) are ranking machines.

### 3. Get into Google News & Google Discover

- **Google News Publisher Center**: submit cognarah.com (free).
- Ensure `NewsArticle` JSON-LD on posts (we currently emit `Article` — upgrade to `NewsArticle` for news pieces).
- Add author schema pages (`/authors/[slug]`) with `Person` JSON-LD linking to social profiles. Boosts E-E-A-T.

### 4. GEO — get cited by ChatGPT, Perplexity, Google AIO

AI search cites sources with:
- Clear headings + short paragraphs + bulleted facts
- Named entities, dates, numbers (models love citable data)
- Original reporting/quotes (not aggregation)
- Strong schema (Article + Breadcrumb + Organization + Author)
- `llms.txt` (already present — good)

**Action**: add an "AI-answer friendly" summary block at the top of each article (TL;DR bullets). Add FAQPage schema to how-to and explainer posts.

### 5. Backlinks (authority)

Semrush says you have essentially none yet. Fastest legit wins:
- **Guest posts** on TechCabal, Rest of World, Semafor, Sifted, The Rundown AI
- **HARO / Qwoted / Terkel** — reporters need AI quotes daily
- **Newsletter cross-promo** with 3–5 AI newsletters
- Get startups you cover to link back ("as featured in Cognarah")
- Submit to AI directories (There's An AI For That, Futurepedia, aggregators)

### 6. Technical polish (small remaining gaps)

- **Image alt text audit** on articles (hero images must have descriptive alts)
- **Core Web Vitals**: run PageSpeed Insights on 3 top routes; fix any red
- **Internal link density**: every article should link to 2 related articles + 1 pillar
- **Category pages** need unique intros (currently likely template-only)
- **Archive/tag pages**: add `noindex` if thin, or beef up with intros
- **Contrast fix** (open finding) — publish current fixes

### 7. Distribution (feeds Google indirectly)

- **X/LinkedIn**: auto-post every article
- **Reddit**: r/artificial, r/singularity, r/africa — high referral traffic + link signals
- **Hacker News**: submit strong analysis pieces
- **Newsletter**: your #1 owned channel — grow it aggressively

### What I can build/change vs what only you can do

**I can implement (in a follow-up build turn)**:
- Upgrade Article → NewsArticle schema; add FAQPage schema helper
- Add "TL;DR / Key takeaways" block to article template
- Add category page intros (editable in admin)
- Add `Person` JSON-LD on author pages
- Add related-articles internal linking on category pages
- Draft the *African AI 2026* pillar article + hub page

**Only you can do**:
- Submit to Google News Publisher Center
- Guest posts, HARO responses, outreach
- Publishing cadence
- Social distribution

### Recommended next build step

Pick one and I'll plan + implement:
- **A. Content infrastructure**: NewsArticle schema, TL;DR blocks, author schema, category intros
- **B. Pillar page**: build `/guides/african-ai` hub + draft the 2,000-word pillar
- **C. Both A and B**

Tell me which (or a different priority) and I'll draft the build plan.