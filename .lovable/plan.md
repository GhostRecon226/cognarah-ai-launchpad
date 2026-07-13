## Goal

Update the Skills agent and `skills` table so it can ingest real-world Anthropic-style skill packages, whether the source is a single `SKILL.md` file or a zip bundle containing `SKILL.md` plus `LICENSE.txt` and helper scripts. Extract metadata from the SKILL.md YAML frontmatter, capture license terms, bundle multi-file skills into a zip in storage, and require a permissive license for Tier 1 auto-publish.

## 1. Schema changes (`skills` table)

Single migration:
- Widen `description` limit from 100 to 250 chars (drop/relax existing CHECK constraint if any, otherwise just document; column already `text`).
- Add `license_terms text` (nullable). Value convention:
  - Full license file contents when found.
  - The literal string `'unspecified'` when nothing is detected.
  - `null` only when unknown before agent processing (manual entries).
- Keep `file_url` semantics: points to a single object in `skills-files` bucket. For multi-file packages it points to a generated zip.

Update `src/integrations/supabase/types.ts` will regenerate automatically after migration approval.

## 2. Admin UI (`/admin/skills`)

- Increase `description` textarea `maxLength` guidance to 250.
- Add a `license_terms` textarea (optional, monospace, small). Show current value as read-only preview in the table row tooltip.
- No other layout changes.

## 3. Skills agent parser (`src/lib/agent-skills.server.ts`)

Add a new helper module `src/lib/skill-package.server.ts` responsible for turning a source URL into a normalized package:

```
type ParsedSkillPackage = {
  skillMd: string;              // raw SKILL.md contents
  frontmatter: { name?: string; description?: string; license?: string; [k: string]: unknown };
  body: string;                 // SKILL.md without frontmatter
  files: Array<{ path: string; bytes: Uint8Array }>;  // all files in bundle (incl. SKILL.md)
  licenseText: string | null;   // from LICENSE* file if present
  isBundle: boolean;
};
```

Detection flow per source URL:
1. If URL ends in `SKILL.md` (or a raw github blob for one), fetch directly.
2. If URL points at a GitHub tree/folder (e.g. `github.com/anthropics/skills/tree/main/<slug>`), resolve to the folder's raw contents via the GitHub API (`api.github.com/repos/anthropics/skills/contents/<slug>?ref=main`) and download every file. Bundle into a zip in memory.
3. If URL ends in `.zip`, download and unzip.
4. Otherwise, fall back to the existing Firecrawl scrape path and treat the scraped markdown as the SKILL.md body with empty frontmatter.

Parse YAML frontmatter with a minimal, dependency-free parser (regex over the leading `---\n...\n---` block, handles `key: value` lines including quoted strings). Avoids adding a new npm dep. If a `license:` key is present in frontmatter, prefer it over LICENSE file contents for the "permissive?" check but still store the LICENSE file text in `license_terms` when available.

License extraction:
- Look for any file whose basename matches `/^LICENSE(\.txt|\.md)?$/i` or `/^COPYING$/i`.
- Store its full text in `license_terms`.
- If none found and no `license:` in frontmatter, set `license_terms = 'unspecified'`.

Packaging for storage:
- Single-file source: upload the raw SKILL.md as `skills-files/<slug>/SKILL.md`, set `file_url` to `/api/public/skills-files/<slug>/SKILL.md`.
- Multi-file source: build a zip in memory and upload as `skills-files/<slug>/<slug>.zip`, set `file_url` accordingly. Zip creation uses a tiny inline STORE-only zip writer (no compression) to avoid adding a dependency; alternatively install `fflate` (small, Worker-safe) if a compressed zip is preferred. Preference: `fflate`, since it's ~8 KB and Worker-compatible.

## 4. Draft assembly changes

- Use `frontmatter.name` as `title` when present; fall back to current AI extraction.
- Use `frontmatter.description` as `description` when present (truncate to 250 chars); otherwise let Gemini generate it under the new 250-char limit.
- Use `body` (post-frontmatter markdown) as `content`. Skip the AI extraction step entirely when a valid SKILL.md is found; only run Gemini/Claude when the source is a generic web page. This preserves author voice for Anthropic-format packages.
- `author`: infer from GitHub repo owner (`anthropics`) or frontmatter `author` if present.

Update `SKILLS_SYSTEM_PROMPT`:
- Raise `description` STRICT max from 100 to 250 characters.

Update `validateDraft`:
- Description length check up to 250.

## 5. Tier 1 auto-publish criteria

Extend the six-condition rule in `runSkillsAgentCore`:

1. Source is `github.com/anthropics/skills` (existing).
2. `author` populated.
3. `content` >= 200 chars.
4. No existing skill with same `source_attribution` URL.
5. `file_url` is valid and HEAD returns 2xx (now actually true because we upload).
6. NEW: `license_terms` is not `'unspecified'`, not null, AND does not contain restrictive language. Check via regex against lowercased text:
   - Reject if it matches `\bnoncommercial\b|\bnon-commercial\b|\bno\s+redistribution\b|\ball\s+rights\s+reserved\b` and does not also match a known permissive marker (`\bMIT\b|\bApache\b|\bBSD\b|\bCC0\b|\bUnlicense\b|\bMPL\b`).
   - If unclear (neither permissive nor restrictive markers), treat as unclear and fail Tier 1.

Route to Tier 2 (`published=false`) whenever any of the six conditions fail, exactly as today. Log which condition(s) failed.

## 6. Logging & run summary

- New log lines for: package format detected (single/bundle), license source (frontmatter/file/unspecified), permissive-check outcome, zip upload path.
- Run summary already reports `auto_published` / `manual_review`; keep as is.

## 7. Out of scope

- No changes to News mode.
- No changes to email notification template (skills-auto-published already summarizes titles).
- No new admin filter for license status yet; can add later if needed.

## Technical notes

- Add `fflate` dependency (`bun add fflate`) for zip read/write. It's edge/Worker safe and has no Node built-in requirements.
- GitHub API calls are anonymous (60 req/hr per IP). Enough for expected volume; no token required.
- Storage uploads use `supabaseAdmin.storage.from('skills-files').upload(path, bytes, { upsert: true, contentType })`.
- All strings passed through `stripEmDashes` before insert (unchanged).
- Migration will include: `ALTER TABLE public.skills ADD COLUMN license_terms text;` and any needed CHECK/length relaxations for `description`.

## Files touched

- `supabase/migrations/*` (new): schema change.
- `src/lib/skill-package.server.ts` (new): parser + zip helpers.
- `src/lib/agent-skills.server.ts`: integrate parser, update prompt/validation, extend Tier 1.
- `src/routes/_authenticated/admin/skills.tsx`: 250-char description, license_terms field.
- `package.json`: add `fflate`.
