# Paginate the admin Promotion queue

The promotion queue currently renders every scored article in one long list. This adds pagination so it shows a fixed number of articles per page with page controls at the bottom.

## How it works

- 12 articles per page, matching the site's existing page size for lists.
- Page controls appear under the list, reusing the existing pagination component style already used on the public site.
- The filter buttons (All / Score 55+ / Never promoted) reset back to page 1 when changed.
- A short "Showing X to Y of Z" line sits above the list so it's clear where you are.
- Opening a "Promote" panel and logging a promotion keeps you on the current page.

## Why not paginate in the database

Each article's promotion score is calculated after loading, by blending newsworthiness, freshness, views in the last 7 days, African relevance, packaging and promotion fatigue. The ranking only exists once every candidate is scored, so the full 90-day set (already capped at 200 articles) is loaded and ranked as it is today, then paged for display. This keeps the ordering correct and loading fast.

## Technical detail

- `src/routes/_authenticated/admin/promotion.tsx`: add a `page` state, slice `rows` with the existing `PAGE_SIZE_LIST` and `totalPages` helpers from `src/lib/pagination.ts`, reset `page` to 1 whenever `filter` changes or the row count shrinks, and render controls at the bottom.
- Pagination controls: use a button-based variant of `src/components/site/pagination.tsx` (that component emits `<a href>` links; the admin queue has no URL search params, so a small local control with the same styling and `onClick` handlers is used instead).
- No changes to `src/lib/promotion.functions.ts` or the scoring logic.
