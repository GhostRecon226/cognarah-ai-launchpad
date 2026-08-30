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
working) and the user confirmed it arrived. The full queue-based path
(`send.ts` → `enqueue_email` RPC → pgmq → `queue/process.ts`) is still
**not** live-tested end-to-end — every one of those routes also needs
`SUPABASE_SERVICE_ROLE_KEY`, which isn't in `.env` yet, so they still 500 on
the config-completeness check before ever reaching Resend. Worth doing once
that key is added.

**Still needed, not yet added:**
- `RESEND_WEBHOOK_SECRET` — create a webhook endpoint in the Resend
  dashboard pointing at wherever `/lovable/email/suppression` is publicly
  reachable, subscribed to at least `email.bounced` and `email.complained`;
  Resend gives you the signing secret (`whsec_...`) at that point. Not
  live-tested — needs a public URL Resend can actually POST to.
- `EMAIL_PREVIEW_API_KEY` — any fresh random secret, shared with whatever
  calls `transactional/preview.ts` (the Go API, per its existing comment).

The `/lovable/email/...` route path prefix itself was left unchanged —
renaming it is a separate, optional cleanup (would need updating whatever
calls these routes: pg_cron, the Go API, the Resend webhook config), not
part of this rewrite.

## Phase 4 — `vite.config.ts` / `@lovable.dev/vite-tanstack-config` (last, highest risk)

[vite.config.ts](vite.config.ts) wraps `defineConfig` from
`@lovable.dev/vite-tanstack-config` (currently pinned to `2.13.1` in
`package.json` devDependencies). Per the file's own header comment, that
package bundles, in one opaque call:

- `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths` plugins
- Nitro build config, defaulting to a **Cloudflare** target
  (confirmed live: this session's `npm run build` logged
  `preset: cloudflare-module`)
- `componentTagger` (dev-only — almost certainly wiring for Lovable's visual
  editor's click-to-select-component feature; safe to drop once the editor
  is retired)
- `VITE_*` env injection, the `@` path alias, React/TanStack dedupe
- "error logger plugins" (likely related to `lovable-error-reporting.ts` /
  `__lovableEvents` from Phase 1 — check for overlap before assuming both
  need separate replacements)
- "sandbox detection" (port/host/`strictPort` binding logic for Lovable's
  preview sandbox — irrelevant once not running inside Lovable's infra)

This is last because replacing it means manually reconstructing every one of
those pieces as plain Vite/Nitro config and confirming the app still builds
*and* deploys correctly — a single opaque dependency is being swapped for
several explicit, independently-maintained ones, which is inherently more
surface area for something to be subtly wrong (wrong Nitro preset, missing
env injection scope, dedupe regressions between React/TanStack versions,
etc.).

**Before the code change is possible:**
- No new external account is strictly required for the plugin swap itself,
  but you do need to **decide the deployment target** (this is currently the
  Cloudflare preset via Nitro — is that still where this deploys, or is that
  changing too as part of leaving Lovable's hosting? That decision changes
  what the Nitro config in the replacement looks like).
- Confirm whether `componentTagger` and the "sandbox detection" logic are
  safe to drop outright (yes, if the Lovable editor is fully retired by this
  point — which it should be, since Phases 1-3 removed everything else) or
  whether anything else in the repo secretly depends on them.
- Have `npm run dev` and `npm run build` both passing on the *current* config
  first (see Baseline status above) so there's a real before/after to
  compare once this phase lands — this is the one phase where a silent
  regression (wrong plugin order, missing alias, wrong build target) would be
  easy to miss without one.

Suggested approach when this phase starts: read
`node_modules/@lovable.dev/vite-tanstack-config/dist/index.js` directly to see
exactly what plugin list and options it passes, rather than guessing from the
comment — it's the actual source of truth for what needs replacing 1:1.

## Summary sequence

1. ✅ **Resolve the build baseline blocker** (vite.config.ts entities alias) — fixed via `package.json` overrides, see Baseline status above.
2. ✅ **Phase 1** — cosmetic, zero prerequisites, done.
3. ✅ **Phase 2a** — AI gateway call sites rewritten to call Gemini natively, live-verified with a real `GEMINI_API_KEY` (running on `gemini-3.6-flash`, see note above).
4. ✅ **Phase 2b** — sitemap-resubmit route rewritten to call Google directly, live-verified end-to-end with the Search Console service account.
5. ✅ **Phase 3** — email pipeline rewritten for Resend, live-verified with a real send. Still need `RESEND_WEBHOOK_SECRET` and `EMAIL_PREVIEW_API_KEY` added, and the full queue-based path (vs. calling the sender directly) needs `SUPABASE_SERVICE_ROLE_KEY` to actually test.
6. **Phase 4** — decide deployment target, manually reconstruct the Vite/Nitro config, retire `@lovable.dev/vite-tanstack-config`.

After Phase 4, `package.json` should have zero `@lovable.dev/*` packages and
`grep -rniI lovable src` should return nothing but historical comments (or
nothing at all).
