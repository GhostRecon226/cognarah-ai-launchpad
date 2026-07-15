## Root cause

The agent fetches sources, scrapes them, then calls Gemini for every candidate — and every Gemini call fails with:

```
Gemini 404: This model models/gemini-2.5-flash is no longer available to new users.
Please update your code to use a newer model.
```

The model id `gemini-2.5-flash` in `src/lib/agent-core.server.ts` (constants `GEMINI_TEXT_MODEL` / `GEMINI_IMAGE_MODEL`) is no longer served on this API key. Every candidate errors, `created` stays at 0, and the run ends with "No drafts created".

Two secondary issues make it feel like it "runs forever":

1. In-flight runs are never timed out. There are currently 2 rows in `agent_runs` still marked `status: running` from earlier attempts (they finished, but the code path threw before the finalizer). The UI polls these and shows a spinner indefinitely.
2. The `.functions.ts` handler awaits `runAgentCore` end-to-end, so with ~15 candidates × failing Gemini calls (each still triggers Firecrawl scrape + Anthropic fallback attempts + throttling), a single run can wall-clock into minutes even when doomed to fail.

## Fix plan

1. **Update Gemini model ids** in `src/lib/agent-core.server.ts`:
   - `GEMINI_TEXT_MODEL` → `gemini-flash-latest` (currently GA on v1beta for all keys; falls forward automatically). Keep an env override `GEMINI_TEXT_MODEL` so we can swap without a redeploy.
   - `GEMINI_IMAGE_MODEL` → `gemini-2.5-flash-image` stays, but also make it env-overridable via `GEMINI_IMAGE_MODEL`.
2. **Fail fast on model 404s.** In `callGemini`, if the first attempt returns 404 with `NOT_FOUND`, throw immediately without burning the whole retry ladder, and surface a clear log line so we spot deprecations early.
3. **Abort the run early if the first Gemini call 404s** for the whole run (not just per-candidate). Track a run-level `modelUnavailable` flag; when set, stop the worker pool, mark the run `error` with a message like "Gemini model X unavailable, update GEMINI_TEXT_MODEL", so it stops spinning through every candidate.
4. **Reap stuck runs.** At the start of `runAgentCore`, mark any `agent_runs` with `status = 'running'` and `started_at < now() - interval '15 minutes'` as `status = 'error'` with error `Run timed out or crashed`. Also enforce a hard wall-clock ceiling (e.g. 10 min) inside the run and abort workers past that.
5. **Verify.** After the edit, re-run the agent from `/admin/agent` with count = 1, then check `agent_runs` for `status = success` and a non-null `drafts_created`.

## Technical details

- File: `src/lib/agent-core.server.ts` — constants near line 165, `callGemini` around 175–219, `runAgentCore` finalizer around 720–738.
- Model reference: Google's v1beta `generateContent` endpoint. The `-latest` aliases (`gemini-flash-latest`, `gemini-pro-latest`) are the recommended non-deprecating pointers for free-tier keys and are what the current AI Studio quickstart uses; `gemini-2.5-flash` is being retired for new keys, which matches the 404 body.
- No schema changes. No UI changes. No changes to Claude editor logic, Firecrawl, or the concurrency pool.
- Optional cleanup query (I'll run it as part of the fix): `UPDATE agent_runs SET status='error', error='Stale run reaped', finished_at=now() WHERE status='running' AND started_at < now() - interval '15 minutes'`.