# AI News Agent: drafts never appear after "Run started"

## What I found

`agent_runs` shows every manual run since 2026‑07‑28 15:52 UTC is still `status='running'` with `drafts_created=0`, `error=null`, `finished_at=null`. The last successful run was 15:41 UTC on 2026‑07‑28, right before the "dispatch to `/api/public/hooks/agent-run`" refactor landed.

Signals that point at the dispatch path:

- Worker logs for the last hour show zero requests to `/api/public/hooks/agent-run` (searched by both `agent` and `agent-run`). The hook is never hit.
- AI Gateway shows zero LLM/image calls in that same window — the pipeline never gets far enough to call Gemini or Claude.
- `agent_runs` rows are created (so `runAgent` runs, inserts the row, and returns `{status:"started"}`), but the sibling POST it fires with `runInBackground(fetch(...))` never lands.

Why the sibling POST disappears: on the Cloudflare-style worker runtime, once the outer server-function response returns, any in-flight `fetch()` is aborted unless it was registered with `ctx.waitUntil`. `runInBackground` does try to call `ctx.waitUntil`, but it reads `globalThis.__lovableRequestWaitUntil`, which is set by `src/server.ts` at the top-level `fetch` and cleared in its `finally`. In practice we're seeing the fetch get cancelled before it hits the network — no hook logs, no LLM calls, run row frozen at `running`.

The dispatch-to-a-sibling-request pattern doesn't buy us anything either: whether we call `runAgentCore` in-process or via a self-fetch, both need `ctx.waitUntil` to outlive the response. The self-fetch just adds a second failure point.

## Plan

Diagnosis-first, then a fix that removes the extra hop.

### 1. Revert `runAgent` to in-process execution with proper waitUntil

In `src/lib/agent.functions.ts`:

- Pre-create the `agent_runs` row exactly as today (so the UI has an id).
- Instead of POSTing to `/api/public/hooks/agent-run`, call `runAgentCore` directly with `existingRunId: runId`, `trigger: "manual"`, `triggeredBy: context.userId`.
- Wrap that call in `runInBackground(...)` so `ctx.waitUntil` keeps the worker alive.
- Keep the `markError` fallback so any synchronous throw before the background work starts still updates the row.
- Return `{ run_id, status: "started" }` immediately as today.

This removes the sibling-fetch that's currently being aborted. The `/api/public/hooks/agent-run` route stays in place for the scheduled cron path — it already works there because pg_cron's request is the top-level fetch, not a subrequest of a returning response.

### 2. Make `runInBackground` observable

In `src/lib/background.server.ts`, log one line whenever it's called saying whether `ctx.waitUntil` was actually available. That way the next time a run stalls we can tell from worker logs whether the runtime accepted the promise or fell through to the fire-and-forget branch. No behavior change.

### 3. Heartbeat + reaper so a stall self-heals and is visible

In `src/lib/agent-core.server.ts` `runAgentCore`:

- Add a `last_heartbeat_at` column update (timestamptz) at each stage boundary: after settings load, after search, after each article scrape, after Gemini call, after Claude call, after each draft insert. Requires a migration adding `agent_runs.last_heartbeat_at timestamptz` (nullable, defaults to `started_at` on insert).
- Extend the existing 15‑minute reaper so it marks any `running` row with `last_heartbeat_at` older than 5 minutes (or `started_at` older than 15 minutes when heartbeat is null) as `error` with reason `"stalled: no heartbeat"`. Run it opportunistically at the start of `runAgentCore` and at the start of `listAgentRuns` so the admin UI listing kicks it too.

### 4. Clean up the frozen rows

One-off SQL in a migration: mark the seven currently-stuck `running` rows as `error` with reason `"stalled: dispatch never reached hook (pre-fix)"` and `finished_at = now()` so the admin UI stops showing perpetual spinners.

### 5. Verify

After deploy: trigger a manual run from `/admin/agent`, then check `agent_runs` for that id — expect `last_heartbeat_at` advancing, `drafts_created` incrementing, and terminal `status='success'`. Also confirm worker logs show the new "waitUntil registered" line from step 2.

## Technical notes

- Files touched: `src/lib/agent.functions.ts` (rewrite `runAgent` handler body), `src/lib/background.server.ts` (add log), `src/lib/agent-core.server.ts` (heartbeat writes + reaper query), one Supabase migration (add column + backfill + mark stuck rows).
- `src/routes/api/public/hooks/agent-run.ts` is unchanged; scheduled pg_cron keeps using it.
- No prompt / model / editorial changes. This is purely a runtime-reliability fix.
- `AGENT_CRON_SECRET` and `PUBLIC_SITE_URL` are no longer required for manual runs after this change (still used by the scheduled hook).
