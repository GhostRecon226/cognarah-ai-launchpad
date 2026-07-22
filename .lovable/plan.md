
## Goal

Make the `/startups/submit` form capture enough information for staff to write a full startup autobiography from the admin backend, and make sure everything a founder types is displayed on the admin detail view.

## What the form captures today

Basic (company name, website, country, city, year founded, stage), Product (500-char description, 500-char problem, target audience, AI technologies checklist), Team (founder name, founder LinkedIn, team size), Traction (users, revenue stage, funding, investors, partnerships), Media (logo, one demo link, press links), Contact (email, contact method, WhatsApp).

## Gaps that block a good autobiography

1. Descriptions are capped at 500 characters, which is too short for a profile piece.
2. No founding story, mission, vision, or company tagline.
3. Only one founder field. No co-founders or key team members.
4. No differentiator / competitors field.
5. No business model or pricing.
6. No milestones, awards, or notable achievements.
7. No social presence beyond founder LinkedIn (no X handle, no company LinkedIn, no YouTube/demo video).
8. Only one media asset (logo). No product screenshots, no pitch video, no product hero image.
9. No geographic markets served.
10. No roadmap / what's next.

## Plan

### 1. Expand the form (`src/routes/startups.submit.tsx`)

Add these fields, grouped by existing sections. All optional unless noted, all with generous limits so nothing gets truncated.

- Basic identity
  - Company tagline (1 line, required, 120 chars)
  - Company logo already present
  - Company LinkedIn URL, X / Twitter handle, YouTube URL (optional)
- Product and mission
  - Raise `product_description` and `problem_solved` limits from 500 to 1500 chars
  - Mission statement (required, 500 chars)
  - Differentiator: "What makes you different from competitors" (required, 1000 chars)
  - Main competitors (optional, comma-separated)
  - Business model / how you make money (required, 500 chars)
  - Pricing model (optional, 300 chars)
  - Markets served (optional, comma-separated countries/regions)
- Team
  - Co-founders (optional, repeatable: name + role + LinkedIn) — capped at 4
  - Key team members (optional textarea, 1000 chars)
- Traction
  - Milestones / notable achievements (optional textarea, 1000 chars)
  - Awards and recognition (optional textarea, 500 chars)
- Media
  - Product screenshots upload (optional, up to 3 images, 2 MB each)
  - Pitch or demo video URL (optional)
- Roadmap
  - What's next in the next 12 months (optional, 800 chars)

Keep the "no em dashes" rule; keep required field validation both client and server side.

### 2. Persist all new fields (database migration)

Extend `public.startup_submissions` with the new columns:

- `tagline text`
- `company_linkedin text`
- `twitter_handle text`
- `youtube_url text`
- `mission text`
- `differentiator text`
- `competitors text`
- `business_model text`
- `pricing_model text`
- `markets_served text[]`
- `cofounders jsonb`  (array of `{ name, role, linkedin }`)
- `key_team_members text`
- `milestones text`
- `awards text`
- `screenshot_urls text[]`
- `pitch_video_url text`
- `roadmap text`

All nullable so existing rows keep working. No RLS changes needed (INSERT policy stays open with `consent = true`, admin/editor SELECT/UPDATE stays the same).

### 3. Update the server function (`src/lib/startup-submissions.functions.ts`)

- Extend `StartupSubmissionInput`, the input validator, and the `insert` payload to include the new fields.
- Sanitize (strip em dashes) and length-check the new text fields.
- Upload extra screenshot images to the `media` bucket the same way the logo is uploaded, store the resulting URLs in `screenshot_urls`.
- Include the new fields in the admin notification email payload (tagline, mission, differentiator, business model at minimum).

### 4. Update the admin backend view (`src/routes/_authenticated/admin/startups.tsx`)

Render every new field in the expanded row so staff never has to guess what the founder submitted:

- New "Company" details row: tagline, mission, company LinkedIn, X, YouTube.
- "Positioning" block: differentiator, competitors, business model, pricing, markets.
- "Team" block: co-founders list + key team members.
- "Traction" block additions: milestones, awards.
- "Media" gallery: logo + screenshot thumbnails + pitch video link.
- "Roadmap" block.

Also add a small "Copy all details" button that copies a plaintext dump of every field, to make it easy for staff to paste into an editor when writing the profile.

### 5. Update the AI draft prompt

`generateStartupDraft` should feed the new fields (tagline, mission, differentiator, business model, milestones, awards, roadmap, screenshots, competitors, markets) into `buildStartupUserPrompt` so the generated autobiography uses them. Structure stays the same, no facts invented.

### 6. Verify

After the migration and build, do a Playwright test-fill against `/startups/submit` with all fields populated, then query `startup_submissions` to confirm every field landed in the row, and open `/admin/startups` to confirm every value renders.

## Technical notes

- Migration follows the project rules: `ALTER TABLE` only adds columns, no CHECK constraints on mutable data, existing GRANTs and RLS untouched.
- Screenshots reuse the existing `media` bucket and `/api/public/media/*` route; no new bucket needed.
- Base64 upload pattern already used for the logo is reused for screenshots (with a max-3 loop).
- No changes to categories, articles table, or authentication.

## Open question

Do you want the new required fields (tagline, mission, differentiator, business model) enforced as required for new submissions, or all-optional so founders can submit fast and staff can request follow-ups later?
