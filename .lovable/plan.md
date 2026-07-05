## Problem

Last run (`1e437447…`) scraped 10+ fresh candidates and produced a JSON draft for every one, but all were dropped by `validateDraft` with `body too short (281–388 words)`. The new Cognarah style guide asks for 500–700-word news pieces, but Gemini is mirroring the source article length (~280–350 words) instead of expanding with context + Africa Angle, so nothing ever passes the 500-word floor.

## Fix (only `src/lib/agent-core.server.ts`)

1. **Lower the hard floor, keep a soft target.**
   - Change `validateDraft` body minimum from **500** → **350** words. This still rejects thin/broken outputs but stops discarding otherwise-good drafts.
   - Keep title (≥6 words) and dek (≥15 words) checks unchanged.

2. **Push Gemini to actually hit the target length.**
   - Add an explicit length rule to `SYSTEM_PROMPT`: "Minimum 500 words for news, 800 for analysis. If the source is thin, expand with verifiable context, background, and the required Africa Angle paragraph — never pad, but never under-deliver."
   - Strengthen the retry nudge (2nd attempt) to specifically call out length: "Your previous draft was only N words. Rewrite to at least 500 words by expanding the Africa Angle paragraph and adding verifiable context from the source — do not invent facts."
   - Pass the actual measured word count into the nudge so the model sees the gap.

3. **Log why a draft was accepted at what length**, so future runs are easier to diagnose:
   - When a draft passes, log `Draft accepted: <N> words (attempt <k>)`.

No changes to Firecrawl search, URL/date filters, Claude editor stage, hero image pipeline, dedupe, or DB insert.

## Why not just lower the floor to 300?

350 keeps a real quality bar (a 280-word wire rewrite with no Africa Angle is not what Cognarah wants) while unblocking the ~340–390-word drafts we're currently discarding. Combined with the tighter length instruction, most drafts should land at 450–600 words.

## Out of scope

- Changing the Claude editor pass (it only refines; length is Gemini's job).
- Widening `search_time_window`, adding sources, or touching the schedule.
- Any UI change on `/admin/agent`.
