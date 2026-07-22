## Scope

Two changes to the admin, no public-site changes.

### 1. Paginate `/admin/articles` (20 per page)

`src/routes/_authenticated/admin/articles.index.tsx` currently loads the entire `articles` table into a single React state array. We'll add server-side pagination and a total count.

- Fetch with `.range(from, to)` and `{ count: "exact" }`, using the shared helpers already in `src/lib/pagination.ts` (`getRange`, `totalPages`), with page size 20.
- Track `page` in local state (resets to 1 when the status filter changes).
- Reuse the existing `<Pagination />` component from `src/components/site/pagination.tsx`. Since it's an anchor-based component built for URL hrefs, we'll either (a) pass `buildHref="#"` and intercept clicks to update local state, or (b) switch this route to URL search params (`?page=N`) via `validateSearch` for proper back-button behavior. Recommending **(b)** — consistent with how public pages already do it.
- Show "Showing X–Y of Z" above the table.

### 2. "Top articles" analytics panel on `/admin`

`src/routes/_authenticated/admin/index.tsx` is the admin dashboard. Add a new section:

- **Top 10 most-viewed (all time)** — query `articles` ordered by `view_count desc` limit 10, published only. Table with columns: rank, title (links to edit), category, views, published date.
- No schema change needed — `view_count` already exists and is incremented on every article read via `increment_article_views`.

### Out of scope

- Public site pagination (already shipped on category / author / search).
- Homepage or new `/articles` archive (user said not needed).
- Time-bounded analytics (last 30 days, per-category) — user picked all-time top 10 only.

## Technical notes

- No DB migration required.
- Files touched:
  - `src/routes/_authenticated/admin/articles.index.tsx` — add `validateSearch` for `page`, switch loader to `.range()` with count, wire `<Pagination />`.
  - `src/routes/_authenticated/admin/index.tsx` — add top-articles query + table section.
- Keep the existing supabase-js query shape; select string stays a single literal so the type-perf pitfall doesn't apply.
