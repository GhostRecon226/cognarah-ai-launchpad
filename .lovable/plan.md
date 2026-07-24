
## What's actually happening

Two independent bugs, both real:

### 1. Hero regeneration always fails with `GEMINI_MODEL_UNAVAILABLE`

In `src/lib/agent-core.server.ts` line 168:

```ts
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-exp";
```

`gemini-2.0-flash-exp` no longer exists on Google's `v1beta` API, so every call to `generateAiImage` (agent runs AND the "Regenerate hero" button) fails with the exact 404 you're seeing. The image‑capable Gemini model that returns inline PNG data on that endpoint is **`gemini-2.5-flash-image`** (Nano Banana). This one‑line default is wrong for every code path that generates images.

### 2. Navigating away from `/admin/agent` kills the run mid‑flight

`runAgent` in `src/lib/agent.functions.ts` is a normal `createServerFn` — the admin UI does `await _runAgent(...)`, which is a `fetch()` from the browser. On Cloudflare Workers, when the client disconnects (tab closed, route change), the runtime terminates the request context. Everything still in progress — remaining candidates, hero image generation, Supabase inserts — is aborted. That's why you end up with partial articles and missing heroes when you leave the page.

The scheduled cron path (`/api/public/hooks/agent-run`) has the same problem in principle, but it always runs to completion because there is no client to disconnect.

## The fix

### Step 1 — swap the image model (immediate hero fix)

In `src/lib/agent-core.server.ts`:

```ts
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
```

That alone unblocks:
- "Regenerate hero" from the article editor
- Hero image generation inside every future agent run

No other code change is needed for the model — `callGemini` already sends `responseModalities: ["IMAGE","TEXT"]` and extracts inline image data, which is exactly what `gemini-2.5-flash-image` returns.

### Step 2 — make manual runs survive tab close / navigation

Detach the actual work from the browser request using Cloudflare's `ctx.waitUntil`, which is designed for this: it tells the runtime "keep this Worker alive until the promise settles, even after the HTTP response has returned."

Wire it in three small pieces:

1. **`src/server.ts`** — the wrapper already receives `ctx`. Stash it on a per‑request `AsyncLocalStorage` (or a simple `globalThis` slot per invocation) so downstream code can reach it.

2. **New helper `src/lib/background.server.ts`** — exports `runInBackground(promise)`:
   - If a Cloudflare `ctx.waitUntil` is available, register the promise there.
   - Otherwise (local dev / Node), fall back to a plain fire‑and‑forget with `.catch(console.error)`.

3. **`src/lib/agent.functions.ts` → `runAgent`** — change the handler to:
   - Insert a `pending` row into `agent_runs` (so the UI immediately gets a `run_id`).
   - Call `runInBackground(runAgentCore({ ..., existingRunId }))`.
   - Return `{ run_id, status: "started" }` right away.

   `runAgentCore` needs a tiny tweak to accept an optional pre‑created `run_id` and update that row instead of inserting a new one.

4. **`src/routes/_authenticated/admin/agent.tsx`** — after `_runAgent(...)` returns, don't block on completion. Poll `agent_runs` by id (or re‑fetch the run list) every few seconds and update the UI when `status` flips to `success`/`error`. The existing runs table is already the natural place to show this.

Net effect: closing the tab, navigating to another admin page, or refreshing no longer aborts the run. The Worker keeps generating drafts, hero images, and writes to Supabase in the background.

### Step 3 — belt‑and‑braces reaper (already exists, keep it)

The 15‑minute stuck‑run reaper in `runAgentCore` stays as‑is. It's the safety net if a background run ever crashes without updating its row.

## Technical details

- Files touched:
  - `src/lib/agent-core.server.ts` — one‑line model default swap; accept optional existing `runId` in `runAgentCore`.
  - `src/server.ts` — capture Cloudflare `ctx` per request into async‑local storage.
  - `src/lib/background.server.ts` — new tiny helper exporting `runInBackground`.
  - `src/lib/agent.functions.ts` — `runAgent` returns immediately after scheduling.
  - `src/routes/_authenticated/admin/agent.tsx` — client polls run status instead of awaiting completion.
- No schema changes required. `agent_runs` already has `status`, `drafts_created`, `log`, `error`, `finished_at`.
- No new env vars. `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` continue to be used as today.
- Scheduled cron path (`/api/public/hooks/agent-run`) is unchanged.

## Out of scope

- I'm not migrating to a queue table, a separate worker service, or Supabase pg_cron for manual runs. `ctx.waitUntil` is the right primitive on Cloudflare and it keeps the change small.
- No prompt / editorial / schema changes — this is purely a reliability fix.

## What you'll see after

- Clicking "Regenerate hero" produces an image instead of the 404 toast.
- Clicking "Run now" on `/admin/agent`, then immediately closing the tab or navigating away, still results in the full number of drafts (with hero images) appearing in the articles list a few minutes later — same as when the cron fires it.
