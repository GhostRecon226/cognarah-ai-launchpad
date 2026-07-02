# Fix AI News Agent Output Quality

Investigation revealed the issues aren't all in the agent — one is a UI bug that made real content look empty. Full breakdown and fix plan below.

## What's actually happening

I queried the database for the two drafts in your screenshots:

| Article | Body in DB | Hero |
|---|---|---|
| "The Global AI Shift…" | **3,942 chars of real HTML** | `null` |
| "Silicon Valley's Fragile Peace…" | **4,143 chars of real HTML** | Sunglasses image |

So the "empty body" you're seeing is actually a **Tiptap editor bug**, not the agent. The editor initializes with `content: ""` on first mount and never re-syncs when the loader finishes fetching the article — the body is stored, just not displayed. Fixing this alone will make both articles look dramatically better.

The remaining problems ARE agent quality:
- Both source URLs are **tag/section index pages** (`wired.com/tag/artificial-intelligence/`, `techcrunch.com/category/artificial-intelligence/`) — not individual articles. Their `og:image` is the site's generic marketing image (hence the sunglasses).
- Rewriting from a tag page = generic, headline‑less content ("Silicon Valley to New Frontiers" is vague because there's no real story underneath).
- Search queries are too broad and don't restrict to recent, article-shaped URLs.

## Fixes

### 1. Tiptap editor: sync when article loads (`src/components/admin/tiptap-editor.tsx`)
Add a `useEffect` that calls `editor.commands.setContent(value)` when `value` changes and differs from the current editor HTML. This restores body display for all agent drafts (past and future) and for any article opened for editing.

### 2. Filter out non-article URLs (`src/lib/agent-core.server.ts`)
Reject search candidates whose URL path looks like a listing:
- Path segments containing `tag`, `tags`, `category`, `categories`, `topic`, `topics`, `section`, `author`, `feed`.
- Paths ending at the section (`/tag/artificial-intelligence/`) with no article slug after.
- Require at least one deep segment plus either a date fragment (`/2026/`, `/2025/`) or a slug ≥ 4 words.

### 3. Recency + article‑shaped search
- Add Firecrawl `tbs: "qdr:w"` (past week) so we stop rewriting evergreen tag pages.
- Better query templates: `"latest {focus} news"`, `"{focus} announcement this week"`, `"African AI startup {focus}"` — and drop the `site: OR site: OR …` mega-filter (it hurts recency). Instead, run one query per trusted domain when domains are configured.
- After scrape, require the page to look like an article: `metadata.title` present, ≥ 600 words, and either a `publishedTime`/`article:published_time` meta or a date pattern in the URL. Skip otherwise (log "not an article").

### 4. Stricter hero image relevance (your chosen strategy)
Prefer the scraped source image but validate:
- Reject if `ogImg` URL contains `logo`, `default`, `placeholder`, `share`, `social-card`, `fallback`, or is served from a path unrelated to the article slug (e.g. `/wp-content/uploads/sites/…/default-…`).
- Reject if image dimensions (from HTTP `content-length` heuristic + `image-size` sniff on the buffer) are < 600×400.
- Do a cheap Gemini vision check: send the downloaded image + article title/dek and ask `"Does this image plausibly illustrate this article? Answer yes or no with 1-line reason."` — reject on `no`.
- On any rejection, fall back to a much better AI‑generated hero (see 5).

### 5. Better AI‑generated hero prompts
Include concrete subject nouns extracted from the title/dek (companies, technologies, geographies) instead of just the title string. Example: `"Editorial magazine hero for a story about {subject_nouns}. Cinematic, symbolic, no text, no logos, dark navy backdrop with lavender and coral accents. Aspect 16:9."` Use `google/gemini-3-flash-image` for faster/cheaper generation, keep 2.5 as fallback.

### 6. Stronger editorial prompt
Rewrite the system prompt for the rewrite step:
- Require the headline to name **the actor and the action** ("Anthropic Pushes Back on White House AI Rules" — not "Silicon Valley's Fragile Peace").
- Require the dek to include one concrete fact (a number, a date, a name) from the source.
- Require body sections to include a "Why it matters" H2 near the top and a "The bigger picture" H2 near the end — TechCrunch/Axios pattern.
- Enforce 550–850 words, ban corporate filler phrases ("in today's fast-paced world", "revolutionary", "game‑changing"), require inline `<a>` links to at least two named entities/sources.
- Keep `response_format: json_object` but add a validation pass: if `title` is < 6 words, dek < 15 words, or body < 500 words → retry once with a "your previous draft was too generic, be more specific" nudge; skip on second failure.

### 7. Log improvements
Log the source URL classification decision, the hero-image decision path, and the retry count so the Runs table log makes root-causing future issues easy.

## Files touched
- `src/components/admin/tiptap-editor.tsx` — value sync effect.
- `src/lib/agent-core.server.ts` — everything else (URL filters, search tweaks, hero validation, prompt overhaul, retry loop, richer logging).

No database migrations, no schema changes, no changes to the CMS UI beyond the editor fix.

## Out of scope (ask before doing)
- Publishing changes to existing drafts (I'll leave them as-is so you can re-run the agent and compare).
- Changing the schedule or per‑run count.
- Adding image editing/branding overlay on top of source hero images.
