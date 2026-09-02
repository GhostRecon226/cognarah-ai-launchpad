# Cognarah

Content site + built-in AI agent, originally scaffolded and developed in Lovable.
As of this migration, primary development moves to Claude Code, working directly
against this GitHub repo (GhostRecon226/cognarah-ai-launchpad).

## Stack

- TanStack Start (React, SSR) on Vite, not a plain SPA
- Supabase (Postgres, auth, storage)
- Package manager: npm (repo ships a bun.lock from Lovable, but bun isn't required;
  npm install / npm run dev work fine)
- Dev server: `npm run dev`, serves on http://localhost:8080

## The built-in AI agent

Not a Lovable-only feature, real app code:

- `src/lib/agent-core.server.ts` and `src/lib/agent-skills.server.ts` - core agent logic
- `src/routes/api/public/hooks/agent-run.ts` - webhook entry point, checks `AGENT_CRON_SECRET`,
  this is what an external scheduler pings to trigger a run
- `src/routes/_authenticated/admin/agent.tsx` - admin UI to run/inspect it manually
- Calls Anthropic (`claude-sonnet-4-6`) and Gemini (text + image) directly via fetch,
  plus Firecrawl for scraping and the GitHub API for skill publishing
- As of the Lovable migration Phase 2 (see LOVABLE-MIGRATION.md), both
  `agent-skills.server.ts` and `startup-submissions.functions.ts` call Gemini
  natively through `src/lib/gemini.server.ts` (needs `GEMINI_API_KEY`) — no
  longer routed through `ai.gateway.lovable.dev`.

## Environment variables

Required, not all present in the committed `.env` (only the Supabase public keys are):

- SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_PROJECT_ID (+ VITE_ versions) - present
- SUPABASE_SERVICE_ROLE_KEY - server-side, sensitive, get from Supabase dashboard
- ANTHROPIC_API_KEY
- GEMINI_API_KEY (optional: GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, have defaults) -
  now also required for agent-skills.server.ts / startup-submissions.functions.ts,
  see note above
- FIRECRAWL_API_KEY
- GITHUB_TOKEN - used for skill publishing back to GitHub
- AGENT_CRON_SECRET - shared secret for the agent-run webhook
- GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL, GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY - a
  Google Cloud service account (Search Console API enabled, added as a Full/Owner
  user on the cognarah.com property), replaces the old GOOGLE_SEARCH_CONSOLE_API_KEY
  which was a Lovable connector secret, not a real Google credential
- SITE_URL / PUBLIC_SITE_URL
- RESEND_API_KEY - email pipeline (Phase 3, done 2026-08-30), sends via
  notify.cognarah.com (verified in Resend), replaces LOVABLE_API_KEY /
  LOVABLE_SEND_URL / @lovable.dev/email-js entirely
- RESEND_WEBHOOK_SECRET - verifies Resend's bounce/complaint webhook signatures
  (format `whsec_...`, from the Resend dashboard once a webhook endpoint pointing
  at /lovable/email/suppression exists), replaces @lovable.dev/webhooks-js
- EMAIL_PREVIEW_API_KEY - internal shared secret gating
  /lovable/email/transactional/preview (only the Go API calls this), replaces
  reusing LOVABLE_API_KEY for that purpose — pick any fresh random secret

LOVABLE_API_KEY, LOVABLE_SEND_URL, and GOOGLE_SEARCH_CONSOLE_API_KEY are no
longer used anywhere in this repo as of Phase 3 completion.

## Known repo quirks

- `.env` is tracked in git (not in .gitignore). Currently it only holds public
  Supabase keys, which is low-risk, but any real secret must NOT be added to this
  file as-is. Recommend gitignoring `.env` and untracking it, keeping secrets local.
- No `.github/workflows` and no visible cron config in the repo. The AGENT_CRON_SECRET
  check implies something external pings `/api/public/hooks/agent-run` on a schedule.
  Check Supabase (pg_cron/pg_net - there are cron-related migrations) and/or an
  external scheduler tied to the old Lovable-hosted domain to find and replicate it.
- GitHub sync to Lovable's editor was disconnected 2026-08-30 (was previously
  a reason to avoid force-push/rebase/amend on main, since it rewrote history
  Lovable's editor depended on — no longer a constraint, that git-safety
  banner has been removed from AGENTS.md along with the file itself since it
  had no other content).

## Post-migration goals (stated by Peter, 2026-08-30) — both done as of 2026-09-02

Once fully off Lovable (LOVABLE-MIGRATION.md phases complete), the priority wasn't
parity, it was making Cognarah meaningfully better than the Lovable-built version in
two specific areas he named. Both are now substantially complete:

1. **AI agent capability** — go beyond "same agent, new host." Shipped to
   agent-core.server.ts: multi-step pipeline autonomy (QA self-correction pass with
   deletion-focused correction on fabricated claims, generalized corroboration
   research), multi-criteria newsworthiness scoring (novelty/credibility/impact/
   specificity sub-scores + source-tier signal, replacing one holistic number),
   Gemini temperature tuning per call type, broader publish-date detection. Also
   added automated legitimacy + AI-relevance scoring for startup submissions
   (previously fully manual triage) — see src/lib/startup-submissions.functions.ts
   and the AI Score column on /admin/startups.
2. **Performance & SEO** — audited Core Web Vitals, technical SEO, and Cloudflare-
   specific hosting concerns, then fixed every critical/high and medium finding:
   a dead Organization-schema logo reference (was 404 on every page, plus visibly
   broken on 4 more pages including the whole admin panel), several hydration-
   mismatch bugs (same class as a prior AdSense ad-unit bug), missing image
   dimensions, sitemap resubmission wired to the real publish flow (was dead code),
   a genuinely broken service worker (sw.js was a live 404 despite a clean build —
   root cause was nitro's build orchestration discarding dist/client before
   vite-plugin-pwa ever scanned it; fixed with an explicit post-build script,
   scripts/generate-sw.mjs), Cloudflare edge caching on cacheable routes, sanitize-
   html moved from render-time to write-time (removed ~164KB from the article page's
   client bundle), a hardcoded-domain-string / hardcoded-sitemap-categories cleanup,
   BreadcrumbList schema and OG-image fallbacks on category/author pages, and a
   pinned compatibility_date + explicit cpu_ms limit. Critical-CSS inlining was
   deliberately skipped (see git history on vite.config.ts for why). Full detail
   in commit history: "Performance & SEO: fix all 7 critical/high findings from the
   audit" and "Performance & SEO: medium-priority audit items".

Remaining, low-priority/non-blocking: Cloudflare's default robots.txt blocks AI
crawlers (GPTBot, ClaudeBot, etc.) — confirm with Peter whether that's a deliberate
content-licensing stance before touching it. No Bing IndexNow integration (no
organic-search impact either way).

Explicitly NOT prioritized: visual design/branding and new content/feature surface
area. Don't go there unless asked.
