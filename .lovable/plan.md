## Goal
Trigger the AI News Agent end-to-end and confirm it produces a saved draft in the `articles` table.

## Steps

1. **Reap any stuck runs** — `UPDATE agent_runs SET status='error', finished_at=now() WHERE status='running' AND started_at < now() - interval '15 minutes'` so a stale row doesn't block or confuse the check.

2. **Snapshot baseline** — record current counts:
   - latest `agent_runs` row (id, status, started_at)
   - `articles` count where `status='draft'`

3. **Invoke the agent server function directly** in News mode (same entry point the `/admin/agent` "Run now" button uses in `src/lib/agent-core.server.ts`). Run via `stack_modern--invoke-server-function` so we don't depend on the browser UI.

4. **Poll `agent_runs`** every ~30s for up to ~10 minutes until the newest row's `status` becomes `success` or `error`. Read `stats_json` / `error_message` for detail.

5. **Verify draft persistence** — query `articles` for rows created after the baseline timestamp with `status='draft'`; list slug, title, category, hero image URL, word count.

6. **Inspect logs on failure** — if status is `error` or 0 drafts saved:
   - `ai_gateway_logs--list_ai_gateway_requests` for the run window (Claude calls)
   - `supabase--read_query` on `agent_runs.error_message` and any `stats_json.errors`
   - Report the specific failing stage (Gemini search, Firecrawl scrape, Claude refine, image gen, validateDraft) with the exact error string.

## Deliverable
A short report: run id, duration, drafts saved (with titles), and — if none — the precise failure point and suggested next fix. No code changes in this pass; fixes come in a follow-up plan if needed.
