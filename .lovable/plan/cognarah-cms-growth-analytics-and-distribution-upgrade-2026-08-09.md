# Cognarah CMS: Growth, Analytics and Distribution Upgrade

## What exists today (verified)

- Article views: a single lifetime counter per article (`articles.view_count`), incremented by an RPC call on the public article page. There is no per-day history, no visitor identity, no referrer capture.
- Google Analytics 4 (gtag) is installed sitewide, but its reporting API is not connected, so the CMS cannot read GA numbers yet.
- Subscribers and startup submissions both carry timestamps, so month-over-month growth for those two is genuinely computable from existing data.
- African relevance metadata already exists on articles (score, reason, evidence, angle used, angle type) and is produced inside the agent pipeline.
- The agent pipeline already discovers stories, scrapes them, scores African relevance, drafts with Gemini, refines with Claude, and saves drafts.

Because per-day view history was never recorded, all time-windowed view metrics will show "No data available" for periods before this upgrade. Lifetime totals stay accurate and are shown separately.

## Phase 1: Analytics foundation

**New tracking**
- Add a page-view event table capturing article, timestamp, an anonymised daily visitor hash (derived server side from IP + user agent + a rotating salt, never stored raw), referrer host, and any UTM parameters on the URL.
- The public article page records one event per view through a public server endpoint, and still increments the existing lifetime counter so nothing regresses.
- Referrers are classified into Direct, Search, LinkedIn, X, WhatsApp, Facebook, Newsletter, Referral, Other.

**Google Analytics reporting**
- Connect the Google Analytics account so the CMS can also read GA4 unique visitors and channel data, including history from before this upgrade. First-party numbers stay the source of truth; GA figures appear alongside, clearly labelled. If the connection cannot be established, the GA panels simply state that GA reporting is not connected.

**Redesigned dashboard**
- Primary KPI row: Total Article Views, Views This Month (with change vs the previous month once two months of data exist), Unique Visitors, Subscribers (with this-month growth), Startup Submissions (with this-month count).
- Secondary compact row keeps Published, Drafts, Categories, Authors.
- Top Articles section with Today / 7 days / 30 days / All time filters showing title, category, published date, views, promotion score, African relevance, status, plus unique visitors and top traffic source where recorded. Rows link to the article's performance view.
- Category Performance table: article count, total views, average views, median views, best article.
- Insights panel: short generated observations computed strictly from the project's own data, with an explicit "not enough data yet" state when sample sizes are too small.

## Phase 2: Editorial intelligence

- **Newsworthiness score (0-100)** assessed before drafting, judging AI centrality, whether something meaningful happened, audience relevance, novelty, source quality and editorial value. Stored on the article with its reason. Low scores are skipped or flagged for manual review; the score never triggers automatic publishing on its own.
- **Duplicate protection**: each candidate is compared against recently published articles on main entity, event, product, company and topic before drafting. Substantial repeats are skipped and recorded in the run log rather than drafted again.
- **Promotion score (0-100)** calculated after an article is drafted, estimating how strongly the story should be distributed, weighing newsworthiness, timeliness, audience interest, recognisable entities, practical value, conversation potential, novelty and genuine evidence-backed African relevance. Stored with a plain-English reason, a list of signals and a generation timestamp. Shown in the CMS only, never on the public site. Bands: 0-39 Low Priority, 40-59 Standard, 60-79 Promote, 80-100 Priority Story.
- Scores can be regenerated manually per article from the CMS.

## Phase 3: Distribution engine

- **Promotion Queue** page in the admin navigation, sorted by promotion score then recency, filterable by band, African relevance, category, published date and promoted status. Each row shows thumbnail, title, category, published time, promotion score, African relevance, views and promotion status.
- **LinkedIn copy generator** for articles scoring 60+, producing a hook drawn from verified article content, three genuinely useful takeaways, one specific conversation question, and the article link supplied separately. Two variants: Cognarah publication voice and a personal founder voice. No fabricated statistics, no clickbait, no algorithm claims.
- **UTM builder** with per-channel defaults (LinkedIn and WhatsApp as social, Newsletter as email) and a one-click copy of the tracking URL.
- **Promotion tracking**: a new record per article and channel with the UTM values used, who logged it and when. Editors mark an article as promoted directly from the queue. Manual only; no automatic posting to external networks.
- **Article performance view** inside article management: total views, views over time, promotion score, newsworthiness score, African relevance, distribution channels used, traffic sources, publication date and last promoted date, with unique visitors and engagement shown where the data supports it.

## Data integrity rules applied throughout

- No estimated or reconstructed historical figures anywhere.
- Metrics with no underlying data render "No data available", never zero.
- First-party data collected after this upgrade is visually separated from GA history.
- Insights are suppressed when the sample is too small to support a claim.

## Technical notes

- New tables: `article_views` (event log, admin-read only, insert via a public server endpoint with basic abuse guards) and `article_promotions`. New article columns: `promotion_score`, `promotion_reason`, `promotion_signals`, `promotion_generated_at`, `newsworthiness_score`, `newsworthiness_reason`. Existing African relevance columns are reused as-is.
- Aggregation runs in server functions behind the existing staff role check; the dashboard reads through those, not raw client queries.
- Scoring and social copy reuse the existing Gemini and Claude helpers in the agent core; no new AI providers or dependencies.
- Existing CMS navigation, cards, tables and styling are reused. No unrelated screens are redesigned.
- Publishing, categories, authors, startups, subscribers, media, users, settings and the current agent behaviour remain unchanged apart from the new assessment steps.

## Order of work

Phase 1 lands first so data starts accumulating immediately, then Phase 2, then Phase 3. Each phase is reviewable on its own.
