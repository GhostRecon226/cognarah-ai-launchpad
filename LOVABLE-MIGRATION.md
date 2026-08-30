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
git-sync banner was intentionally left alone — that one's still true as long
as this repo's GitHub sync to Lovable is connected, which wasn't confirmed
disconnected, only that the editor UI itself isn't used. `enqueue-internal.server.ts`'s
comment referencing the `/lovable/email/...` route path was also left as-is
since that route still lives there until Phase 3.

| Item | File(s) | Notes |
|---|---|---|
| "Build with Lovable" badge/section | [README.md:51-61](README.md#L51-L61) | Marketing text, delete or rewrite. |
| Lovable git-sync warning banner | [AGENTS.md:1-10](AGENTS.md#L1-L10) | Remove once Lovable's GitHub sync is actually disconnected — until then the warning is still true (see [CLAUDE.md](CLAUDE.md#L60-L62)), don't remove prematurely. |
| Preview-editor auth broker | [src/integrations/supabase/previewAuthStorage.ts](src/integrations/supabase/previewAuthStorage.ts) | Only runs when the app is loaded inside a `lovableproject.com`/`lovable.app`/`gptengineer.*` iframe, brokering the Supabase session to Lovable's editor via `postMessage`. Dead code once nobody opens this project in Lovable's live editor. **Check first**: confirm the Lovable editor preview is no longer in active use — removing this breaks that iframe's login if it is. |
| Service-worker preview-domain gating | [src/lib/register-sw.ts:12-16](src/lib/register-sw.ts#L12-L16) | Disables SW registration on Lovable preview hosts. Same caveat as above — safe once the editor preview is retired. |
| Editor error-reporting hook | [src/lib/lovable-error-reporting.ts](src/lib/lovable-error-reporting.ts), its import/call in [src/routes/__root.tsx:14,45](src/routes/__root.tsx#L14) | `window.__lovableEvents` only exists when Lovable's editor injects it; a no-op everywhere else. Safe to delete. |
| Internal global var naming | `__lovableRequestWaitUntil` in [src/server.ts:72-86](src/server.ts#L72-L86) and [src/lib/background.server.ts:9,22](src/lib/background.server.ts#L9) | Purely a name (`waitUntil` plumbing for background work outliving the HTTP response) — rename in both files together, no behavior change. |
| "Connect Supabase in Lovable Cloud" error text | [src/integrations/supabase/client.ts:17](src/integrations/supabase/client.ts#L17), [client.server.ts:18](src/integrations/supabase/client.server.ts#L18), [auth-middleware.ts:20](src/integrations/supabase/auth-middleware.ts#L20) | Just wording in a console.error message when Supabase env vars are missing — Supabase itself isn't routed through Lovable. Reword to something generic. |
| Lovable-referencing code comments | [vite.config.ts:1-6](vite.config.ts#L1-L6), [background.server.ts:8](src/lib/background.server.ts#L8), [enqueue-internal.server.ts:3](src/lib/email/enqueue-internal.server.ts#L3) | Comments only. The `vite.config.ts` one documents what `@lovable.dev/vite-tanstack-config` bundles — keep it (or its replacement) until Phase 4 actually removes that package, then it's obsolete too. |

## Phase 2 — Direct API calls (AI gateway, Search Console connector)

### 2a. AI gateway (`ai.gateway.lovable.dev`)

Two call sites, both proxying the **same underlying model**
(`google/gemini-3-flash-preview`) through an OpenAI-compatible
chat-completions shape:

- [src/lib/agent-skills.server.ts:55-68](src/lib/agent-skills.server.ts#L55-L68) (`callLovableAI`, used at [line 293](src/lib/agent-skills.server.ts#L293) for skill-drafting from scraped pages)
- [src/lib/startup-submissions.functions.ts:416-436](src/lib/startup-submissions.functions.ts#L416-L436) (`geminiDraftStartup`)

Both already have a direct-Anthropic fallback path (`refineWithClaude` /
`claudeMessage`) sitting right next to them, so the direct-API pattern in this
codebase is already established — this phase just extends it to the primary
call instead of only the fallback.

**Before the code change is possible:**
- A `GEMINI_API_KEY` that works directly against Google's Gemini API (not
  Lovable's gateway). Per [CLAUDE.md:48-49](CLAUDE.md#L48-L49) the current key
  lives only in Lovable's project secrets panel — either pull that value out,
  or (cleaner, since the goal is zero Lovable dependency) generate a fresh key
  from Google AI Studio / Vertex AI directly and don't reuse whatever Lovable
  provisioned.
- Confirm `ANTHROPIC_API_KEY` is likewise a real key you hold outside Lovable
  (it's called directly already, but if it was ever a Lovable-issued key,
  rotate it to one from your own Anthropic Console account).

**Why this isn't a pure URL swap:** the gateway calls use an OpenAI-style
`messages` + `response_format: {type: "json_object"}` request/response shape.
Google's native Gemini API has a different request shape (`contents` instead
of `messages`, `generationConfig.responseMimeType` instead of
`response_format`, different response envelope). The rewrite has to translate
both the request builder and the response parser in both call sites, not just
repoint a hostname.

### 2b. Google Search Console connector (`connector-gateway.lovable.dev`)

[src/routes/api/public/hooks/resubmit-sitemap.ts:5-34](src/routes/api/public/hooks/resubmit-sitemap.ts#L5-L34)
— pings `https://connector-gateway.lovable.dev/google_search_console` with
`Authorization: Bearer $LOVABLE_API_KEY` and
`X-Connection-Api-Key: $GOOGLE_SEARCH_CONSOLE_API_KEY` to resubmit
`cognarah.com`'s sitemap.

**Before the code change is possible:**
- A Google Cloud project with the **Search Console API** enabled.
- A service account (or OAuth client) created in that project, with its
  email added as a verified **Owner or Full user** on the `cognarah.com`
  property in Search Console — without that verification step, calls to
  Google's API will 403 regardless of credentials.
- Note: the current `GOOGLE_SEARCH_CONSOLE_API_KEY` is likely just an
  internal secret Lovable's own connector gateway uses to look up its stored
  Google OAuth token on their side — it may not be a Google-issued credential
  at all. Don't assume it's reusable; check what it actually is in Lovable's
  connectors panel, but plan to provision fresh Google-side credentials
  regardless.

Once the service account exists, the rewrite calls
`https://searchconsole.googleapis.com/webmasters/v3/sites/.../sitemaps/...`
directly (a `PUT` or `GET+notify`, need to check exact verb wanted) with a
Google-issued bearer token, dropping both `LOVABLE_API_KEY` and
`GOOGLE_SEARCH_CONSOLE_API_KEY` from this route entirely.

## Phase 3 — Email pipeline

Highest-touch phase before the vite config rewrite: three routes, two
packages, and a DNS-level dependency.

| File | Role | Lovable coupling |
|---|---|---|
| [src/routes/lovable/email/queue/process.ts](src/routes/lovable/email/queue/process.ts) | Drains the send queue | `sendLovableEmail()` from `@lovable.dev/email-js`, using `LOVABLE_API_KEY` + `LOVABLE_SEND_URL` |
| [src/routes/lovable/email/suppression.ts](src/routes/lovable/email/suppression.ts) | Bounce/complaint webhook | `verifyWebhookRequest()` from `@lovable.dev/webhooks-js`, HMAC-keyed on `LOVABLE_API_KEY` |
| [src/routes/lovable/email/transactional/send.ts:9-11](src/routes/lovable/email/transactional/send.ts#L9-L11) | Sends a transactional email | `SENDER_DOMAIN = "notify.cognarah.com"` — comment says this **must** match a subdomain delegated to Lovable's nameservers |
| [src/routes/lovable/email/transactional/preview.ts](src/routes/lovable/email/transactional/preview.ts) | Internal template preview | Just gated by `LOVABLE_API_KEY` as an auth token, no other coupling |
| [src/lib/email/enqueue-internal.server.ts](src/lib/email/enqueue-internal.server.ts) | Internal queue writer, bypasses the JWT-gated send route | No direct Lovable call, just references the route above in a comment |

**Before any code change is possible:**
1. **Pick a transactional ESP** (Resend, Postmark, SES, SendGrid, etc.) and
   create an account.
2. **Domain delegation**: `notify.cognarah.com` is currently delegated to
   Lovable's nameservers for email sending (SPF/DKIM/DMARC are almost
   certainly set up there, not in your own DNS). Before rewriting `send.ts`,
   you need to either re-delegate that subdomain's NS records to your own DNS
   provider, or add the new ESP's required SPF/DKIM/DMARC/return-path records
   directly if `cognarah.com`'s root DNS is already outside Lovable's control
   (worth checking which is actually true — CLAUDE.md only says the
   subdomain is delegated, not the whole domain).
3. **Webhook secret** from the new ESP for bounce/complaint delivery, to
   replace the HMAC verification `@lovable.dev/webhooks-js` currently does
   against `LOVABLE_API_KEY`.
4. Only after DNS + ESP account exist can `queue/process.ts` and
   `suppression.ts` be rewritten against the new ESP's SDK/webhook format, and
   `@lovable.dev/email-js` + `@lovable.dev/webhooks-js` dropped from
   `package.json`.

Note the `/lovable/email/...` route path prefix itself is just a URL
namespace — renaming it is optional and separate from removing the
underlying Lovable calls; not required for the dependency removal itself, but
worth doing in the same pass so nothing user-facing still says "lovable" in
the URL.

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

1. **Resolve the build baseline blocker** (vite.config.ts entities alias) — decide fix-now vs. accept unknown baseline.
2. **Phase 1** — cosmetic, zero prerequisites, do anytime.
3. **Phase 2a** — get a direct `GEMINI_API_KEY`, rewrite the two AI gateway call sites.
4. **Phase 2b** — provision Google Search Console API access, rewrite the sitemap-resubmit route.
5. **Phase 3** — pick an ESP, migrate DNS, rewrite the email queue/suppression/send routes.
6. **Phase 4** — decide deployment target, manually reconstruct the Vite/Nitro config, retire `@lovable.dev/vite-tanstack-config`.

After Phase 4, `package.json` should have zero `@lovable.dev/*` packages and
`grep -rniI lovable src` should return nothing but historical comments (or
nothing at all).
