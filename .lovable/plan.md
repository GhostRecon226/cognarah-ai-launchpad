
# AI News Curation Agent

Build an agent that discovers AI news from the web, writes full articles, attaches a hero image, and saves everything as a **draft** in the CMS. You keep full editorial control — nothing publishes until you flip the status to Published.

## How it works

1. **Sources**
   - Web search via **Firecrawl** (broad live discovery across the web for AI news, events, funding, Africa AI).
   - Plus a **Trusted Sources** list you manage in the CMS (RSS feeds / domains like TechCrunch AI, MIT Tech Review, The Verge AI, etc.). Broad search + trusted sources both feed the same pipeline.

2. **Triggers**
   - **Scheduled**: runs automatically on a cron schedule you set (e.g. daily at 7am).
   - **Manual**: a "Generate Drafts" button in `/admin` where you can pick a topic/category, a source preset, and go.

3. **Per run**
   - Produces **1–3 draft articles** (you configure the exact count per run).
   - Each draft gets: title, dek/subtitle, category, tags, full body (~500–900 words) in rich HTML compatible with the Tiptap editor, SEO title + meta description, source citations, and a hero image.

4. **Images**
   - Try to pull the source article's hero image first (via Firecrawl scrape → open graph / main image).
   - Store it in the `media` bucket via the signed-URL proxy already in place.
   - If unavailable or unusable → fall back to **AI-generated image** (Lovable AI: `google/gemini-3.1-flash-image` / Nano Banana 2), styled to match Cognarah's editorial look.

5. **De-duplication**
   - New `agent_runs` and `agent_seen_sources` tables track URLs already ingested so the agent never drafts the same story twice.

6. **Safety rails**
   - All output saved as `status = 'draft'` — never auto-publishes.
   - Every draft shows a "Curated by AI" badge in the article list plus source URLs, so you can verify before publishing.
   - Admin-only: only users with `admin` or `editor` role can trigger runs.

## What you'll see in the CMS

- **New page `/admin/agent`**
  - "Run Now" button (choose count 1–3, optional category/topic).
  - Recent runs table: timestamp, drafts created, status, errors.
  - Schedule settings: enable/disable, cron expression, default count, default category focus.
  - Trusted sources manager: add/remove RSS feeds and domains.
- **Article list** shows an "AI Draft" tag for agent-generated posts.

## Technical outline (for reference)

- **Firecrawl connector** — link via `standard_connectors--connect` for search + scrape.
- **DB additions** (single migration): `agent_settings`, `agent_sources`, `agent_runs`, `agent_drafts_log` (dedupe by URL hash); `articles` gets nullable `agent_run_id` + `source_urls text[]`.
- **Server functions** (`src/lib/agent.functions.ts`, admin-gated via `requireSupabaseAuth` + `has_role`):
  - `runAgent({ count, category? })` — orchestrates: search → scrape top N → LLM curation → image → insert draft.
  - `listRuns`, `getSettings`, `updateSettings`, `listSources`, `addSource`, `removeSource`.
- **LLM**: `google/gemini-3-flash-preview` for curation & writing (structured output via `Output.object` for title/dek/body/tags/SEO). Prompt is Cognarah editorial voice, no plagiarism (rewrites in own words), always cites sources at the bottom.
- **Image pipeline**: Firecrawl scrape returns metadata → download → upload to `media` bucket → store storage path. Fallback: call Lovable AI image endpoint → upload result → store path. Uses existing `MediaImage` + signed-URL proxy.
- **Cron**: `/api/public/hooks/agent-run` route (apikey-auth) + `pg_cron` job created from `agent_settings.cron_expression`.
- **Draft insert**: matches existing `articles` schema (status='draft', author = a dedicated "Cognarah AI" author row auto-seeded in the migration).

## Setup you'll need to do

1. Confirm plan → I run the migration and scaffold the code.
2. Link the **Firecrawl** connector when I prompt (one click).
3. Open `/admin/agent`, hit "Run Now" for a test → review the drafts in `/admin/articles`.
4. Enable the schedule when you're happy with output quality.

Say the word and I'll build it.
