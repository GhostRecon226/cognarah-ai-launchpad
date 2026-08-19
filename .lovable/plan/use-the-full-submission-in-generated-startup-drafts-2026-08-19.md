# Use the full submission in generated startup drafts

Two gaps confirmed in the draft generator (`src/lib/startup-submissions.functions.ts`):

1. The prompt passes most fields, but the required structure only has 6 sections (Problem, Solution, Team, Traction, Africa Angle, closing) with a 500-800 word cap and an instruction to omit anything not fitting. So mission, differentiator, competitors, business model, pricing, markets served, milestones, awards, roadmap, press links and social handles are frequently dropped by the model.
2. Screenshots are never given to the AI at all. `screenshot_urls` is uploaded and stored on the submission, but it is not in `buildStartupUserPrompt`, and the article insert only uses `logo_url` as the hero image. So extra photos are always unused.

## What changes

**Richer, coverage-driven prompt**
- Add the missing facts to the prompt payload, including the logo URL and every screenshot URL.
- Expand the required structure: Problem, Solution (with pricing and business model), Team, Traction (users, revenue, funding, investors, partnerships, milestones, awards), Markets and Competition (markets served, competitors, differentiator), Roadmap, Africa Angle, closing.
- Raise the target length to roughly 700-1100 words so the extra sections have room.
- Add an explicit rule: every provided field must appear somewhere in the body; only genuinely empty fields may be skipped. Facts still may not be invented.
- Add a "Links" block at the end of the body: website, LinkedIn, Twitter/X, YouTube, demo, pitch video, press coverage, rendered only for values that exist.

**Use the screenshots**
- Instruct the model to place each screenshot inline as a `<figure><img src="..."><figcaption>...</figcaption></figure>` in a relevant section, in the order supplied, with alt text derived from the company and product.
- After generation, verify every screenshot URL appears in `body_html`; append any missing ones as a "Product screenshots" gallery block before the Source footer. This guarantees no photo is lost even if the model ignores one.
- Keep the logo as `hero_image`, unchanged.

**Post-generation coverage guard**
- After Claude refinement (or Gemini fallback), check the body for the key long-form fields (mission, differentiator, competitors, business model, pricing, markets, milestones, awards, roadmap). If several are absent, run one corrective pass asking the editor model to fold the missing facts in without altering existing ones; if that pass fails, keep the current draft rather than losing content.
- Also protect the refinement step: reject a Claude result that drops screenshot images or the Source footer, and fall back to the Gemini draft in that case.

## Technical notes

- All edits are confined to `src/lib/startup-submissions.functions.ts`: `STARTUP_SYSTEM_PROMPT`, `buildStartupUserPrompt`, `claudeRefineStartup` validation, and the `generateStartupDraft` handler.
- Claude `max_tokens` raised from 4096 to 8192 so the longer body is not truncated mid-JSON.
- Screenshot URLs are already relative media proxy paths (`/api/public/media/...`) which render correctly in article bodies, so no storage or URL changes are needed.
- Sanitization (em dash stripping) and the existing sanitize/insert/update flow stay as they are.
