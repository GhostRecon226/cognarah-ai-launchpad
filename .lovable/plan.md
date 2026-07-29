## Problem

Every manual agent run since the `ctx.waitUntil` refactor is stuck at `status=running` with an empty `log`, meaning `runAgentCore` never got past its first line. On Lovable's Cloudflare-style runtime, `ctx.waitUntil(runAgentCore(...))` isn't reliably keeping the isolate alive to run a multi-minute in-process pipeline — the isolate suspends after the response returns and the promise never progresses. Only the run row (written before `runInBackground`) makes it to the DB.

## Fix

Stop trying to run the entire pipeline inside the original request's isolate. Instead, dispatch the work to a fresh worker invocation via the existing public hook, so each run gets its own request lifetime and CPU budget.

### 1. `src/routes/api/public/hooks/agent-run.ts`
- Accept an optional JSON body: `{ run_id?, count?, focus?, category_id?, triggered_by? }`.
- When `run_id` is provided, pass it through as `existingRunId` to `runAgentCore` and use the supplied `count`/`focus`/`triggered_by` instead of the scheduled defaults (trigger stays `"manual"` in that case).
- Preserve existing scheduled behavior when the body is empty.
- Same `AGENT_CRON_SECRET` auth as today.

### 2. `src/lib/agent.functions.ts` — `runAgent`
- Still pre-create the `agent_runs` row and return `run_id` immediately.
- Replace the in-process `runInBackground(runAgentCore(...))` with a self-fetch:
  - Build the URL from `PUBLIC_SITE_URL` / `SITE_URL` (fallback to `request.url` origin captured via a lightweight helper) plus `/api/public/hooks/agent-run`.
  - POST JSON `{ run_id, count, focus, category_id, triggered_by: userId }` with header `x-agent-cron-secret: AGENT_CRON_SECRET`.
  - Wrap the `fetch(...)` in `runInBackground(...)` so `ctx.waitUntil` keeps the parent request alive just long enough to dispatch the subrequest; the subrequest itself is a fresh worker invocation and owns its own lifetime.
  - On dispatch failure, mark the run row `status=error` with a clear message so the UI stops polling forever.
- If `AGENT_CRON_SECRET` is missing, mark the run `error` immediately with an actionable message ("Set AGENT_CRON_SECRET to enable background agent runs").

### 3. `src/lib/background.server.ts`
- No changes; still used to attach the dispatch fetch to `ctx.waitUntil`.

### 4. `src/lib/agent-core.server.ts`
- No functional change. Confirm the existing 10-minute hard limit and 15-minute stuck-run reaper stay in place so any future stalls self-heal.

### 5. Clean up currently-stuck rows
- One-time SQL: mark the four `running` rows with no `finished_at` and older than 20 minutes as `error` with message "Stalled: background dispatch not delivered (pre-fix)" so the admin UI shows them as failed instead of spinning.

## Secrets

Requires `AGENT_CRON_SECRET` (already used by the cron hook). If it isn't set in this environment, I'll prompt to add it before shipping — without it, the self-fetch would 401.

## Verification

1. Trigger a manual run from `/admin/agent`, close the tab immediately.
2. Reopen a minute later: run should progress (`log` fills, `drafts_created` climbs) and finish with `status=success`.
3. Trigger a run, wait for it to finish while staying on the page: same result, UI stops polling.
4. Confirm the scheduled cron path still works (empty-body POST to the hook).
