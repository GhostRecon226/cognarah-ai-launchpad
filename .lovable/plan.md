# Conditional African Relevance for the News Agent

Cognarah becomes African-first, not Africa-forced. Today every draft is required to contain a "Cognarah Angle" section that connects the story to Africa, which forces generic African commentary onto global stories. This adds a scored relevance step so the African angle appears only when there is real evidence for it.

## New pipeline step

The existing flow (discover, scrape, verify freshness and length, draft with Gemini, refine with Claude, strip em dashes, hero image, save as draft) stays exactly as it is. One assessment step is inserted after the source is scraped and verified, before drafting:

```text
Discover -> Scrape/verify -> Assess African relevance (0-5)
   -> if score >= 3: one targeted African research search
   -> Draft (Gemini, structure chosen by score) -> Claude editor -> Save draft
```

### Relevance assessment

A single cheap Gemini call scores the scraped article 0 to 5 against the signal list (availability, pricing, API/payments, compute and data centres, connectivity, African languages, regulation, developers, startups, funding, enterprise adoption, fintech, health, agriculture, education, government, telecoms, jobs and BPO, skills, research, security, African competitors, customers, market expansion). It returns the score, a one-line reason, the evidence it relied on, and an angle type. If it cannot name concrete evidence for a 3 or higher, the score is downgraded automatically before drafting.

### Targeted research (score 3+ only)

For scores of 3 or higher, the agent runs one extra web search on the African dimension of the specific story using the existing search helper, and passes the findings into the drafting prompt. If the search turns up nothing usable, the score drops to 2 and the dedicated African section is not written. This adds a few seconds per qualifying story and is capped at one search per story to protect the run time ceiling.

## Prompt changes

The drafting prompt is restructured so the African section is conditional instead of mandatory:

- Scores 0 and 1: global story, explanation, significance, takeaway. No mention of Africa at all, no Cognarah Angle Africa requirement. The Cognarah Angle remains as Cognarah's own analysis and stance but is not Africa-bound.
- Score 2: one brief contextual sentence only where genuinely useful, no dedicated section.
- Scores 3 and 4: a dedicated evidence-supported African section, with a contextual heading generated for that story (never a default "What This Means for Africa").
- Score 5: African context woven throughout the whole article rather than isolated in a closing section.

Added rules: no generic continent-wide claims ("could transform businesses across Africa" and similar) unless the article states the evidence; name specific countries, sectors or companies; never fabricate statistics, partnerships, adoption data or quotes; accuracy and newsworthiness outrank African relevance. The editorial edge, sourcing separation, length minimums and the em dash ban are unchanged. Claude's editor instruction is updated to match, so it no longer enforces an Africa section on low-score stories.

## Editorial metadata

Five internal fields are stored on each generated article: `africa_relevance_score` (0-5), `africa_relevance_reason`, `africa_evidence`, `africa_angle_used`, `africa_angle_type`. They are for editorial analytics only and are never shown to readers. The run log records the score and reason per story so you can see the agent's judgement in the run status panel.

## Technical notes

- All prompt and pipeline work is in `src/lib/agent-core.server.ts`: a new `assessAfricaRelevance()` helper, an optional research call reusing the existing `runSearch`, a score-conditional section of `SYSTEM_PROMPT` plus per-story structure instructions in the user prompt, and the new columns on the `articles` insert.
- One migration adds the five nullable columns to `public.articles`; existing rows and existing grants and policies are untouched.
- The startup-profile drafting path in `src/lib/startup-submissions.functions.ts` is not changed (those stories are inherently score 5).
- No changes to admin UI, auth, article pages, skills mode, or the run/reaper logic.
