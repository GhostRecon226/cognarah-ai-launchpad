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
- LOVABLE_API_KEY - only the email pipeline (Phase 3, not yet migrated) still
  needs this; the AI gateway and Search Console connector no longer do
- GITHUB_TOKEN - used for skill publishing back to GitHub
- AGENT_CRON_SECRET - shared secret for the agent-run webhook
- GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL, GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY - a
  Google Cloud service account (Search Console API enabled, added as a Full/Owner
  user on the cognarah.com property), replaces the old GOOGLE_SEARCH_CONSOLE_API_KEY
  which was a Lovable connector secret, not a real Google credential
- SITE_URL / PUBLIC_SITE_URL
- LOVABLE_SEND_URL - used by @lovable.dev/email-js for outbound email, another
  live Lovable-platform dependency worth knowing about

All the above (except the Supabase public keys) currently live only in Lovable's
project secrets/connectors panel, not in this repo. Pull them from there.

## Known repo quirks

- `.env` is tracked in git (not in .gitignore). Currently it only holds public
  Supabase keys, which is low-risk, but any real secret must NOT be added to this
  file as-is. Recommend gitignoring `.env` and untracking it, keeping secrets local.
- No `.github/workflows` and no visible cron config in the repo. The AGENT_CRON_SECRET
  check implies something external pings `/api/public/hooks/agent-run` on a schedule.
  Check Supabase (pg_cron/pg_net - there are cron-related migrations) and/or an
  external scheduler tied to the old Lovable-hosted domain to find and replicate it.
- While still connected to Lovable's GitHub sync: avoid force-push, rebase, or
  amending already-pushed commits on main, it rewrites history Lovable's editor
  depends on. Once Lovable is fully disconnected this restriction goes away.

## Post-migration goals (stated by Peter, 2026-08-30)

Once fully off Lovable (LOVABLE-MIGRATION.md phases complete), the priority isn't
parity, it's making Cognarah meaningfully better than the Lovable-built version in
two specific areas he named:

1. AI agent capability — go beyond "same agent, new host." Look for real upgrades
   to agent-core.server.ts / agent-skills.server.ts: research/scoring quality,
   more autonomous or multi-step pipeline behavior, better use of Firecrawl and
   Gemini, smarter startup-submission scoring.
2. Performance & SEO — Core Web Vitals, load speed, technical SEO, actual search
   ranking impact, not just visual polish.

Explicitly NOT prioritized right now: visual design/branding and new
content/feature surface area. Don't go there unless asked.

Recommended sequencing: finish LOVABLE-MIGRATION.md phases 2-4 to a stable,
fully-decoupled state first, before layering these improvements on. Mixing new
capability work into an in-progress infra migration makes both harder to debug
if something breaks.
