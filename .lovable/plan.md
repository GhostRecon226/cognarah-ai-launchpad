## SEO & GEO Review — cognarah.com

### Current state (Semrush + scan)
- **Semrush**: 1 organic keyword, ~0 traffic/mo. Site is very new — Google is still discovering it. Authority will build over months of consistent publishing.
- **Sitemap + robots**: present and correct, pointing at `https://cognarah.com/sitemap.xml`.
- **Search Console**: verified (meta tag in `__root.tsx`), auto-resubmit hook wired.
- **Structured data**: Organization + WebSite JSON-LD at root. Good baseline.
- **Head metadata pattern**: solid — per-route `head()` on `/about`, `/search`, articles, categories.

### Issues found (5 failing findings)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | mid | Home `/` and `__root` share the same title/description — crawlers see duplicate metadata | Give `/` a unique title + 50–160 char description; keep root as generic fallback only |
| 2 | mid | Sitemap missing routes: `/auth`, `/reset-password`, `/setup`, `/admin/*` are correctly excluded, but `/startups/submit` and `/unsubscribe` should be reviewed. Real gap: no article/category `lastmod` coverage check | Audit `src/routes/sitemap[.]xml.ts` — add `/startups/submit`; keep auth/admin excluded (intentional, not indexable) |
| 3 | mid | Some form controls (search input, category/sort selects, newsletter email) lack accessible names | Add `aria-label` to inputs/selects in `src/routes/search.tsx` and `src/components/site/newsletter.tsx` |
| 4 | low | Low contrast text on published site (muted/placeholder utilities) | Replace arbitrary grays with `text-muted-foreground` / `text-foreground` tokens; re-publish |
| 5 | low | Content gap: high-volume keyword **"african ai"** (4,400/mo) matches the site's Africa AI focus but has no dedicated landing content | Publish a pillar article: *"The State of African AI: 2026 Guide"* targeting `african ai` |

### GEO / AI-search readiness
- **Good**: JSON-LD Organization + WebSite, semantic HTML, sitemap, `llms.txt` present, per-route metadata, article dates.
- **Gap**: no `Article` JSON-LD confirmed on `article.$slug.tsx` (needs check), no `BreadcrumbList`, no `FAQPage` where relevant. Adding these boosts citation likelihood in AI answers (ChatGPT/Perplexity/Google AIO).
- **Gap**: `og:image` strategy — verify articles emit their `hero_image` as `og:image` on the leaf route.

### Proposed fix plan (build phase)

1. **Unique home metadata** — `src/routes/index.tsx`: distinct title (e.g. *"Cognarah — AI News, Startups, Funding & Analysis"*) and unique description. Trim root to generic fallback.
2. **Accessibility labels** — add `aria-label` to search inputs/selects and newsletter email input.
3. **Sitemap audit** — add `/startups/submit` to `STATIC_PATHS` in `src/routes/sitemap[.]xml.ts`.
4. **Article JSON-LD audit** — confirm `article.$slug.tsx` emits `Article` schema (headline, datePublished, author, image); add `BreadcrumbList` on articles + categories.
5. **`og:image` audit** — confirm article route sets `og:image` to `hero_image` (absolute URL); confirm no root-level `og:image` leaks.
6. **Contrast pass** — replace any `text-gray-3/400` or low-opacity muted classes with tokens; user re-publishes.
7. **Content**: draft the *African AI* pillar article (optional, higher effort — can be a separate turn).

### Out of scope
- No backend schema changes.
- No design overhaul.
- Content writing for the African AI pillar is a separate turn if you want me to draft it.

Approve and I'll implement steps 1–5 in one pass; step 6 needs your re-publish; step 7 on request.