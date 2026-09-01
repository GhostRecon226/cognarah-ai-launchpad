# Lovable Dependency Removal — Migration Plan

Goal: fully disconnect Cognarah from Lovable's platform (editor sync aside,
which is handled separately per [AGENTS.md](AGENTS.md)) — no runtime calls to
Lovable-hosted infrastructure, no Lovable packages in `package.json`, no
Lovable-authored build config.

No code has been changed as part of writing this plan. Each phase below lists
what changes, what account/credential has to exist *before* the code change is
possible, and the risk level. Phases are meant to be done in order — each one
leaves the app in a working, deployable state before the next starts.

## Baseline status (as of 2026-08-29)

**Fixed. `npm run build` now succeeds cleanly (exit code 0).**

Root cause (for the record): the fresh `npm install` run earlier in this
session (needed to fix an unrelated native-binding crash in `rolldown`)
resolved a different `node_modules` tree than whatever had produced it
before. [vite.config.ts](vite.config.ts) had a hardcoded `resolve.alias`
forcing every import of `entities/lib/decode.js` / `entities/lib/escape.js`
to a specific nested path
(`node_modules/html-to-text/node_modules/htmlparser2/node_modules/entities/lib/esm/...`)
that no longer existed after the reinstall.

Investigating the actual dependency graph showed the alias was never the
right fix in the first place — three different packages need three different
`entities` majors at once (`htmlparser2@^9` wants v7, `sanitize-html`'s
`htmlparser2@^12` wants v8, and `html-to-text`'s bundled `htmlparser2@^8` plus
`@react-email/render` both want v4, specifically for the legacy `lib/`
subpath). npm's normal resolver already handles this correctly by nesting a
private `entities` copy under whichever package needs a version that doesn't
match what's hoisted to the root — the alias was just papering over one
specific (and unstable) hoisting outcome instead of letting resolution work.

Applied fix — pinned `entities@4.5.0` via npm's real `"overrides"` field in
[package.json](package.json), scoped only to the two consumers that need the
v4 `lib/` layout:

```json
"overrides": {
  "@react-email/render": { "entities": "4.5.0" },
  "html-to-text": { "htmlparser2": { "entities": "4.5.0" } }
}
```

This leaves the standalone `htmlparser2` (v7) and `sanitize-html`'s bundled
`htmlparser2` (v8) untouched — verified their nested `entities` copies are
still v7.0.1 and v8.0.0 respectively after reinstalling. The
`resolve.alias` block in `vite.config.ts` was then deleted entirely since
normal module resolution now serves the right file without it. (There was
also a pre-existing `"pnpm": { "overrides": {...} } ` block in
`package.json` pinning the same version — npm never reads that key, which is
presumably why this drifted in the first place; left it in place since
removing it wasn't asked for and it's harmless dead config.)

`npm run build` was re-run twice after the fix to confirm it's not flaky —
both times exit code 0, full SSR + client + PWA service-worker build
completing.

## Phase 1 — Zero-risk cosmetic items ✅ Done (2026-08-29)

No external accounts or credentials needed. Nothing here touches a live
Lovable endpoint; all of it either activates only inside Lovable's own
editor/preview iframe (dead weight in production) or is just naming/text.

Confirmed the Lovable editor/live-preview iframe is no longer used before
removing the three items that only functioned there. `npm run build` and
`npx tsc --noEmit` both pass after these changes (12 files changed, 19
insertions, 169 deletions — mostly dead-code deletion). `AGENTS.md`'s Lovable
git-sync banner was initially left alone since GitHub sync to Lovable wasn't
yet confirmed disconnected — **update 2026-08-30**: sync has since been
disconnected, so the banner (and `AGENTS.md` itself, which had no other
content) was removed. `enqueue-internal.server.ts`'s comment referencing the
`/lovable/email/...` route path was also left as-is since that route still
lives there until Phase 3.

| Item | File(s) | Notes |
|---|---|---|
| "Build with Lovable" badge/section | [README.md:51-61](README.md#L51-L61) | Marketing text, delete or rewrite. |
| Lovable git-sync warning banner | ~~AGENTS.md:1-10~~ (file deleted) | ✅ Removed 2026-08-30 once GitHub sync to Lovable was actually disconnected. `AGENTS.md` had no other content, so the file was deleted rather than left empty. |
| Preview-editor auth broker | [src/integrations/supabase/previewAuthStorage.ts](src/integrations/supabase/previewAuthStorage.ts) | Only runs when the app is loaded inside a `lovableproject.com`/`lovable.app`/`gptengineer.*` iframe, brokering the Supabase session to Lovable's editor via `postMessage`. Dead code once nobody opens this project in Lovable's live editor. **Check first**: confirm the Lovable editor preview is no longer in active use — removing this breaks that iframe's login if it is. |
| Service-worker preview-domain gating | [src/lib/register-sw.ts:12-16](src/lib/register-sw.ts#L12-L16) | Disables SW registration on Lovable preview hosts. Same caveat as above — safe once the editor preview is retired. |
| Editor error-reporting hook | [src/lib/lovable-error-reporting.ts](src/lib/lovable-error-reporting.ts), its import/call in [src/routes/__root.tsx:14,45](src/routes/__root.tsx#L14) | `window.__lovableEvents` only exists when Lovable's editor injects it; a no-op everywhere else. Safe to delete. |
| Internal global var naming | `__lovableRequestWaitUntil` in [src/server.ts:72-86](src/server.ts#L72-L86) and [src/lib/background.server.ts:9,22](src/lib/background.server.ts#L9) | Purely a name (`waitUntil` plumbing for background work outliving the HTTP response) — rename in both files together, no behavior change. |
| "Connect Supabase in Lovable Cloud" error text | [src/integrations/supabase/client.ts:17](src/integrations/supabase/client.ts#L17), [client.server.ts:18](src/integrations/supabase/client.server.ts#L18), [auth-middleware.ts:20](src/integrations/supabase/auth-middleware.ts#L20) | Just wording in a console.error message when Supabase env vars are missing — Supabase itself isn't routed through Lovable. Reword to something generic. |
| Lovable-referencing code comments | [vite.config.ts:1-6](vite.config.ts#L1-L6), [background.server.ts:8](src/lib/background.server.ts#L8), [enqueue-internal.server.ts:3](src/lib/email/enqueue-internal.server.ts#L3) | Comments only. The `vite.config.ts` one documents what `@lovable.dev/vite-tanstack-config` bundles — keep it (or its replacement) until Phase 4 actually removes that package, then it's obsolete too. |

## Phase 2 — Direct API calls (AI gateway, Search Console connector) ✅ Done, live-verified (2026-08-30)

Credentials landed in `.env` (`GEMINI_API_KEY`, `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`,
`GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`, service account given Full access on the
`cognarah.com` Search Console property) and both paths were exercised for
real, not just built:

- **Gemini**: ran `callGeminiJSON` from `src/lib/gemini.server.ts` directly
  (the exact shared function both `agent-skills.server.ts` and
  `startup-submissions.functions.ts` call) with a system/user prompt shaped
  like the real skill-drafting task. Got back real generated JSON matching
  the `SkillDraft` schema (`title`, `description`, `category`, `difficulty`,
  `content` at 208 words, `author`).
- **Search Console**: started the dev server, POSTed to
  `/api/public/hooks/resubmit-sitemap` with a matching `AGENT_CRON_SECRET`,
  got back `{"ok":true,"submitted":"https://cognarah.com/sitemap.xml",...}`
  with a 200 — the full chain worked: JWT signed, exchanged for a Google
  OAuth token, sitemap PUT accepted by `www.googleapis.com/webmasters/v3`.

**Model id changed mid-verification**: `gemini-3.7-flash` (the model
originally requested as "current stable") returned a persistent `503
UNAVAILABLE — high demand` from Google across repeated attempts over several
minutes. Confirmed this wasn't an auth or wiring problem — `gemini-3.6-flash`
succeeded immediately with the same `GEMINI_API_KEY` seconds later, and
Google's own API independently named `gemini-3.6-flash` as the current
replacement in the deprecation error returned for the older `gemini-2.5-flash`.
Flagged this back rather than silently swapping; decision was to ship
`gemini-3.6-flash` now. Worth revisiting `gemini-3.7-flash` later if Google's
capacity issue for it clears — see the comment above `GEMINI_MODEL` in
[gemini.server.ts](src/lib/gemini.server.ts).

`GOOGLE_SEARCH_CONSOLE_API_KEY` (the old Lovable connector secret) is now
fully unused and can be deleted from wherever it's still set.

### 2a. AI gateway (`ai.gateway.lovable.dev`) — done

Both call sites proxied the **same underlying model**
(`google/gemini-3-flash-preview`) through an OpenAI-compatible
chat-completions shape. Both now go through one shared helper,
[src/lib/gemini.server.ts](src/lib/gemini.server.ts), which calls
`generativelanguage.googleapis.com` natively:

- [src/lib/agent-skills.server.ts](src/lib/agent-skills.server.ts) — deleted
  `callLovableAI` entirely, replaced its one call site with
  `callGeminiJSON(SKILLS_SYSTEM_PROMPT, userPrompt)`. Top-level import is
  fine here — this file already carries the `.server.ts` suffix.
- [src/lib/startup-submissions.functions.ts](src/lib/startup-submissions.functions.ts) —
  rewrote `geminiDraftStartup` to call `callGeminiJSON`, but via a **dynamic**
  `await import("./gemini.server")` inside the function, not a top-level
  import. This file has a `.functions.ts` suffix, meaning (per the existing
  comment on `client.server.ts`) it ships to the client bundle — a top-level
  import of a server-only module here would risk bundling server code
  client-side, the same reason `client.server` and `enqueue-internal.server`
  are already dynamically imported elsewhere in this file. Verified after the
  fact: `grep` over `dist/client` for `GEMINI_API_KEY` /
  `generativelanguage.googleapis` came up empty.

Both already had a direct-Anthropic fallback path (`refineWithClaude` /
`claudeMessage`) sitting right next to them, so the direct-API pattern was
already established in this codebase — this just extended it to the primary
call instead of only the fallback.

**Not a pure URL swap, as expected:** the gateway calls used an OpenAI-style
`messages` + `response_format: {type: "json_object"}` shape. Gemini's native
API uses `systemInstruction`/`contents` for the request and
`generationConfig.responseMimeType` instead of `response_format`; the
response comes back as `candidates[0].content.parts[].text` instead of
`choices[0].message.content`. `gemini.server.ts` translates both directions
and joins multiple text parts defensively, and surfaces the model's
`finishReason`/`promptFeedback.blockReason` in the thrown error when no text
comes back, so a safety-filtered response fails loudly instead of silently
returning `undefined`.

The model id originally carried over unchanged from the gateway calls
(`gemini-3-flash-preview`, the same string after the `google/` vendor
prefix) was swapped once live-verified with real credentials — see the
"Model id changed mid-verification" note above for why it's now
`gemini-3.6-flash`.

**Live-verified 2026-08-30** — see the note above the two subsections.

### 2b. Google Search Console connector (`connector-gateway.lovable.dev`) — done

[src/routes/api/public/hooks/resubmit-sitemap.ts](src/routes/api/public/hooks/resubmit-sitemap.ts)
used to ping `https://connector-gateway.lovable.dev/google_search_console`
with `Authorization: Bearer $LOVABLE_API_KEY` and
`X-Connection-Api-Key: $GOOGLE_SEARCH_CONSOLE_API_KEY`. It now calls Google
directly in two steps:

1. [src/lib/google-service-account.server.ts](src/lib/google-service-account.server.ts)
   (new) — exchanges a Google service-account key for a short-lived OAuth2
   access token via the standard JWT-Bearer flow (RS256-signs a claim with
   Node's built-in `crypto`, no `google-auth-library` dependency added, same
   reasoning as `gemini.server.ts`: this codebase calls provider APIs
   directly rather than through SDKs). Reads
   `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL` and `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`.
2. `resubmit-sitemap.ts` uses that access token as a plain bearer token
   against `https://www.googleapis.com/webmasters/v3/sites/.../sitemaps/...`
   — note this is the **legacy Webmasters API v3 host**, not
   `searchconsole.googleapis.com`; the Sitemaps resource (submit/get/list/
   delete) was never ported to the newer host, only Search Analytics and URL
   Inspection were. The path shape (`/webmasters/v3/sites/{site}/sitemaps/{feed}`)
   is unchanged from what the Lovable gateway was already forwarding to,
   since that's Google's real, stable REST path — only the host and the auth
   header changed.
3. Both `LOVABLE_API_KEY` and `GOOGLE_SEARCH_CONSOLE_API_KEY` are gone from
   this route entirely, replaced by the two env vars above. The route file
   loads `google-service-account.server` via dynamic import inside the
   handler for the same client-bundle reason as 2a.

**Live-verified 2026-08-30**: POSTed to the running route with a matching
`AGENT_CRON_SECRET` and got back `{"ok":true,"submitted":"https://cognarah.com/sitemap.xml",...}`
at 200 — full chain confirmed (JWT sign → OAuth token exchange → sitemap PUT
accepted by Google).

## Phase 3 — Email pipeline ✅ Done, live-verified (2026-08-30)

`notify.cognarah.com` was verified in Resend and `RESEND_API_KEY` added, so
this shipped straight through rather than in separate credential/code steps
like Phase 2.

| File | Change |
|---|---|
| [src/lib/resend.server.ts](src/lib/resend.server.ts) (new) | Thin direct wrapper around `POST api.resend.com/emails`, no SDK dependency (same pattern as `gemini.server.ts`). Throws `EmailAPIError` with `.status`/`.retryAfterSeconds` — the exact shape `queue/process.ts`'s `isRateLimited`/`isForbidden`/`getRetryAfterSeconds` already expected, so none of that retry/DLQ logic needed to change. |
| [src/lib/resend-webhook.server.ts](src/lib/resend-webhook.server.ts) (new) | Verifies Resend's webhook signatures (Svix scheme: HMAC-SHA256 over `svix-id.svix-timestamp.body`, `whsec_...` secret) using Node's `crypto`, no `svix` package added. |
| [queue/process.ts](src/routes/lovable/email/queue/process.ts) | `sendLovableEmail` → `sendResendEmail` (dynamic import — route files ship to the client bundle). Also now builds `List-Unsubscribe`/`List-Unsubscribe-Post` headers itself from `payload.unsubscribe_token`, since Lovable's SDK used to build those implicitly and Resend just passes headers through as given. |
| [transactional/send.ts](src/routes/lovable/email/transactional/send.ts), [enqueue-internal.server.ts](src/lib/email/enqueue-internal.server.ts) | Collapsed `SENDER_DOMAIN`/`FROM_DOMAIN` into one `SENDER_DOMAIN = "notify.cognarah.com"` used directly in `from`. **This is a real behavior change, not cosmetic**: the old code sent via `notify.cognarah.com` while showing `noreply@cognarah.com` in the From: header — a Mailgun/Lovable-gateway trick (verified subdomain sends, root domain displays) that Resend doesn't support. Resend requires the `from` address's domain to exactly match a verified domain, and only the subdomain is verified, so the visible From: address is now `noreply@notify.cognarah.com` instead of `noreply@cognarah.com`. |
| [transactional/preview.ts](src/routes/lovable/email/transactional/preview.ts) | Auth switched from reusing `LOVABLE_API_KEY` to a dedicated `EMAIL_PREVIEW_API_KEY`. |
| [suppression.ts](src/routes/lovable/email/suppression.ts) | Rewritten for Resend's actual webhook shape (`{type: "email.bounced"/"email.complained", data: {...}}`) instead of the old `{data: {email, reason, ...}}` the Go API forwarded from Mailgun. No stored mapping from our `message_id` to Resend's `email_id`, so the suppression log's `message_id` is now `null` and Resend's `email_id` goes into `metadata` instead — doesn't affect whether suppression actually works, since that's keyed by email address, not message_id. |
| `package.json` | `@lovable.dev/email-js` and `@lovable.dev/webhooks-js` removed. `@lovable.dev/vite-tanstack-config` stays until Phase 4. |

**Live-verified 2026-08-30**: called `sendResendEmail` directly (the exact
function `queue/process.ts` invokes) with a real send to
chibuzor.opara15@gmail.com from `notify.cognarah.com` — Resend accepted it
(returned a real email id, which also confirms domain verification is
working) and the user confirmed it arrived.

**Full queue path live-verified 2026-08-31**: `send.ts` → `enqueue_email` RPC
→ pgmq → `queue/process.ts` → Resend, driven end to end for real, not just
the sender in isolation.

- Along the way, a `SUPABASE_SERVICE_ROLE_KEY` mix-up surfaced two more
  Supabase projects in play (one empty scaffold, one stale/pre-migration) —
  see the postmortem in this repo's session history if it comes up again;
  `.env` now correctly points at `bgybhqjnzjpzzqinkfkm`, the fully-migrated
  project (schema, data, storage, admin auth user, vault secrets all
  present — verified with real `select` queries against `articles` (202
  rows), `agent_runs` (159), `user_roles`, `email_send_log`, not just
  existence checks, since a HEAD/count-style check gave false positives
  against the empty project during the investigation).
- Created a dedicated `qa-internal@cognarah.com` test account (`editor`
  role, clearly labeled in `user_metadata`) to get a real JWT for `send.ts`'s
  auth check, rather than touching any real user.
- `POST /lovable/email/transactional/send` with that JWT → `{"success":true,"queued":true}`,
  confirmed a `pending` row in `email_send_log`.
- `POST /lovable/email/queue/process` with the service role key →
  `{"processed":1}`, confirmed the log flipped to a new `sent` row
  (append-only — both rows still present).
- Recipient was `info@cognarah.com` (the `skills-auto-published` template's
  fixed `to`) — user confirmed it arrived.

**Still needed, not yet added:**
- `RESEND_WEBHOOK_SECRET` — currently a placeholder
  (`placeholder_pending_hosting_migration`), intentionally left unresolved
  per the user — blocked on the hosting move, needs a public URL before a
  Resend webhook endpoint can be created and give a real `whsec_...` secret.
  `suppression.ts` is code-complete and correct but not live-tested.
- `EMAIL_PREVIEW_API_KEY` — already added to `.env`, not yet exercised
  against `transactional/preview.ts` (low-risk — it's a read-only preview
  endpoint, no send/queue/DB-mutation involved).

Phase 3 is otherwise fully closed: every code path live-verified against
the real, correctly-provisioned database.

The `/lovable/email/...` route path prefix itself was left unchanged —
renaming it is a separate, optional cleanup (would need updating whatever
calls these routes: pg_cron, the Go API, the Resend webhook config), not
part of this rewrite.

## Phase 4 — `vite.config.ts` / `@lovable.dev/vite-tanstack-config` ✅ Done (2026-08-31)

Read the actual package source (`index.js`, `hmr-gate.js`, `dev-server-bridge.js`,
`runtime/fetch-entry.mjs`) rather than trusting the old header comment, which
turned out to be partly wrong.

**Genuinely needed, ported 1:1** into the new [vite.config.ts](vite.config.ts):
`tanstackStart()` (with its `importProtection` default — a real TanStack
feature blocking `.server.ts`/server-only code from client bundles, directly
relevant given how much this migration leaned on that convention),
`viteReact()`, `@tailwindcss/vite`, `vite-tsconfig-paths`, `nitro()`
(`defaultPreset: "cloudflare-module"`, build-only — deploy target unchanged,
per your call to revisit only when hosting actually moves), the `@` path
alias, React/TanStack `resolve.dedupe`, `optimizeDeps` tuning, `VITE_*` env
injection, and `css: {transformer: "lightningcss"}`. `@tanstack/devtools-vite`
kept too (dev-only), per your call — added as an explicit devDependency along
with `lightningcss`, since both were previously only transitive through the
removed package.

**Confirmed dead — Lovable's live-preview/editor sandbox infrastructure,
already inert for us before removal** (all gated behind
`isSandboxEnvironment()`, which checks `LOVABLE_SANDBOX`/
`DEV_SERVER__PROJECT_PATH`, neither ever set here): `hmrGatePlugin`,
`devServerBridgePlugin` (notably its `/_sandbox/preview/execute` endpoint,
which let Lovable's editor run arbitrary JS in the live preview tab — the
kind of thing worth being rid of even though it was already a no-op),
`lovableAssetsProxyPlugin`, `lovableBuildErrorDiagnostics`,
`stripRedundantNodejsCompatFlag`. Also dropped `devServerFnErrorLogger` /
`devSsrErrorLogger` — these ran for us but had no consumer left
(`lovable-error-reporting.ts` was removed in Phase 1), so they'd been
patching TanStack Start's internals to broadcast into the void.

**The old header comment's `componentTagger` claim was simply wrong** —
nothing by that name exists anywhere in the installed package (v2.13.1).
Nothing to port there.

One real TS fix needed: `esbuild.keepNames` (for the `build:dev` script) had
to be dropped — this Vite install's `ESBuildOptions` type no longer includes
that field (Vite 8 shifted much of its transform pipeline to Rolldown). Only
affects the rarely-used `build:dev` script; noted in a code comment in
`vite.config.ts`.

**Verification**: backed up the original as
[vite.config.lovable-backup.ts](vite.config.lovable-backup.ts). Typecheck
clean. `npm run dev` boots and serves real content (homepage, an article
page, `/auth`), console-clean aside from a pre-existing hydration warning
A/B-confirmed to exist identically on the *old* config too (not a
regression). `npm run build` succeeds, produces the identical
`cloudflare-module` Nitro/wrangler output as before.

### ✅ Fixed (2026-09-01) — `__exportAll is not a function`

Was pre-existing (confirmed via A/B test against both the old and new
vite.config.ts — see history below), discovered while verifying Phase 4.
Root-caused and fixed; Phase 5 is no longer blocked by this.

**Root cause:** Nitro's Vite SSR service pre-bundles TanStack Start's server
entry into a single intermediate asset
(`node_modules/.nitro/vite/services/ssr/assets/server-*.js`). Nitro's own
Rolldown build then further chunks that *one* module into **two** output
files (`_ssr/server-<hash>.mjs` and `_ssr/server-<hash>2.mjs`) that
circularly re-export a synthetic `__exportAll` CJS-interop helper through
each other: chunk 1 (14 lines) imports `server_exports` from chunk 2, chunk 2
(1900+ lines, the real content) imports `__exportAll` from chunk 1. Under
spec-compliant ESM this circular pair should still resolve correctly, but
`workerd`'s module loader doesn't guarantee that — `__exportAll` is still an
unassigned `var` (`undefined`) at the point chunk 2 calls it, producing
`TypeError: __exportAll is not a function`. Tried and ruled out first:
- `no_bundle: false` (rebundling through wrangler's own esbuild) — same
  error, just renamed to `__exportAll2`. Confirms it's not a `no_bundle`
  artifact; the circularity survives being re-bundled into one file.
- `rolldownConfig.output.hoistTransitiveImports: false` (the fix Nitro's own
  `deno-server` preset already uses for an analogous edge-runtime + circular
  chunk problem) — changed the generated shape (inlined the helper into
  chunk 1 instead of pulling from `_runtime.mjs`) but the cross-chunk
  circularity, and the error, remained.
- `nitro({inlineDynamicImports: true})` — silently had no effect. Traced via
  a debug patch into `nitro/dist/vite.mjs`: the `cloudflare-module` preset's
  own `rollupConfig.output.inlineDynamicImports: false` is deliberately
  hardcoded and out-merge-prioritizes any option we pass — Cloudflare's
  modern Workers module format is intentionally built around multi-module
  output, so forcing single-file output fights the preset's actual design
  rather than fixing the real bug.
- Bumping `nitro` from `3.0.260603-beta` to the latest `3.0.260610-beta` —
  same error, not yet fixed upstream as of that release.
- Plain `manualChunks` — silently ignored; this project's Vite 8 install
  uses **Rolldown**, not classic Rollup, and Rolldown's actual chunking API
  is `output.codeSplitting.groups`, a different shape entirely.

**Actual fix**, in [vite.config.ts](vite.config.ts)'s `nitro()` call:
```ts
rolldownConfig: {
  output: {
    codeSplitting: {
      groups: [{ test: (id) => /\/assets\/server-[\w-]+\.js$/.test(id), name: "server-entry" }],
    },
  },
},
```
Nitro's default `codeSplitting.groups` (which buckets `node_modules` code
into `_libs/*` chunks) is defu-deep-merged with ours, not replaced — our
group just claims the one source module Rolldown was splitting and forces
it into a single named chunk (`_ssr/server-entry.mjs`), eliminating the
circular reference at the source. Nothing else about the chunking behavior
changes.

**Verified:**
- `npm run build` → clean rebuild → `_ssr/server-DwPNQnRi.mjs` /
  `-DwPNQnRi2.mjs` gone, replaced by one `_ssr/server-entry.mjs` containing
  both (previously circular) `__exportAll` definitions self-contained.
- `wrangler dev` against the built output: `GET /` → `200`, real article
  content in the body (not the error fallback). Also checked `/article/...`
  (200, real body text), `/auth` (200), and the `resubmit-sitemap` API route
  (`401` unauthenticated, as expected — confirms server functions execute
  correctly too, not just page SSR). Zero rows in wrangler's error log
  across all of the above.
- `npm run dev` and `npx tsc --noEmit` both still pass — this only affects
  the `command === "build"` branch.
- Bundle size: 5.7 MB / 170 files vs. the 5.9 MB / 171 files baseline —
  essentially unchanged (marginally smaller, from merging two files into
  one). `no_bundle` stays at Nitro's own default (`true`); the Workers
  multi-module format is untouched.

**Not confirmed:** whether this bug (or the fix) reproduces on an actual
*deployed* Cloudflare Worker, only on `wrangler dev`'s local `workerd`
simulator — no live Cloudflare account/deployment was available to test
against in this session. Worth a real deploy-and-check before fully trusting
Phase 5 on this.

## Phase 5 — Hosting move (not started)

Not yet scoped or planned — this section exists to hold one open question
until Phase 5 actually starts:

- **Unconfirmed: does the `__exportAll` circular-chunk bug (see the "Fixed"
  writeup under Phase 4) actually occur on a real, deployed Cloudflare
  Worker, or was it only ever a `wrangler dev` local-simulator issue?** The
  fix that was applied (forcing Nitro's split server-entry chunk back into
  one) was verified only against `wrangler dev`'s local `workerd` simulator
  — no live Cloudflare account/deployment was available to test against in
  that session. Whoever picks up Phase 5 should do a real `wrangler deploy`
  (or equivalent) and re-run the same verification (homepage, an article
  page, `/auth`, an API route) against the actual deployed Worker before
  trusting this is fully resolved in production.

## Summary sequence

1. ✅ **Resolve the build baseline blocker** (vite.config.ts entities alias) — fixed via `package.json` overrides, see Baseline status above.
2. ✅ **Phase 1** — cosmetic, zero prerequisites, done.
3. ✅ **Phase 2a** — AI gateway call sites rewritten to call Gemini natively, live-verified with a real `GEMINI_API_KEY` (running on `gemini-3.6-flash`, see note above).
4. ✅ **Phase 2b** — sitemap-resubmit route rewritten to call Google directly, live-verified end-to-end with the Search Console service account.
5. ✅ **Phase 3** — email pipeline rewritten for Resend, full queue path (`send.ts` → enqueue → pgmq → `queue/process.ts` → Resend) live-verified end to end against the real database. Only `RESEND_WEBHOOK_SECRET` remains, intentionally blocked on the hosting move.
6. ✅ **Phase 4** — `vite.config.ts` rewritten by hand, `@lovable.dev/vite-tanstack-config` fully retired. `npm run dev` and `npm run build` both verified working. Also surfaced *and fixed* a pre-existing, unrelated Cloudflare Workers runtime bug (`__exportAll is not a function`) — see "Fixed" writeup above — verified against `wrangler dev`'s local simulator; a real Cloudflare deploy still needs checking before fully trusting Phase 5 on this.

`package.json` now has zero `@lovable.dev/*` packages. `grep -rniI lovable src`
still returns the `/lovable/email/...` route path (deliberately unrenamed,
see Phase 3) and a handful of explanatory comments — no remaining functional
dependency on Lovable's platform anywhere in this repo.
