
# Numbered pagination for category, author, and search pages

Adds `?page=N` pagination across the three list surfaces. Category and author pages use 12 per page (matches the 3-col grid). Search uses 24 per page. All use `Supabase.range()` with a `count: "exact"` head query for total count. SEO metadata is set per page, and `rel="prev"`/`rel="next"` link tags are emitted for pages beyond 1.

## Shared pieces

1. **`src/lib/pagination.ts`** (new) — small helpers:
   - `PAGE_SIZE_LIST = 12`, `PAGE_SIZE_SEARCH = 24`
   - `parsePage(raw)` → clamps to `>= 1`
   - `getRange(page, size)` → `{ from, to }` for `.range()`
   - `totalPages(count, size)` → `Math.max(1, Math.ceil(count / size))`

2. **`src/components/site/pagination.tsx`** (new) — presentational component:
   - Props: `currentPage`, `totalPages`, `buildHref(page) => string`
   - Renders Previous / numbered pages (with `…` ellipsis for large ranges) / Next as plain `<a>` tags so `?page=N` deep links work and crawlers see them.
   - Marks disabled prev/next with `aria-disabled` and `pointer-events-none`.
   - Uses `<a>` (not `<Link>`) with same-route href — TanStack `Link` doesn't need typed search-param plumbing per route this way, and Supabase-driven pages already do a hard round trip via the loader.

## Category pages — `src/routes/category.$slug.tsx`

- Add `validateSearch` with `zodValidator` + `fallback(z.number().int(), 1).default(1)` for `page`.
- Add `loaderDeps: ({ search }) => ({ page: search.page })`.
- Loader: fetch category as today, then query articles with `.select("*, author, category", { count: "exact" })`, `.range(from, to)` using `PAGE_SIZE_LIST = 12`. Return `{ category, articles, page, totalPages }`.
- If `page > totalPages && count > 0`, throw `notFound()` so bad URLs 404 instead of showing an empty grid.
- `head()`:
  - Page 1: unchanged title/description.
  - Page > 1: append ` — Page N` to title and `Page N of M — ` prefix to description.
  - `canonical` and `og:url` include `?page=N` when `N > 1` (self-reference per head-meta rule).
  - Add `<link rel="prev">` / `<link rel="next">` when applicable.
- Component: render `<Pagination>` below the grid; `buildHref = (p) => p === 1 ? "/category/{slug}" : "/category/{slug}?page={p}"`.

## Author pages — `src/routes/authors.$slug.tsx`

Same pattern as category, `PAGE_SIZE_LIST = 12`:
- Add `validateSearch` + `loaderDeps` for `page`.
- Loader uses `.range()` + count.
- `head()` gets ` — Page N` suffix, `canonical`/`og:url` include `?page=N`, prev/next links. Person JSON-LD stays only on page 1 (leaf metadata for the author entity, not paginated lists).
- Component renders `<Pagination>` after the grid.

## Search page — `src/routes/search.tsx`

Bigger change: today it uses `useState` + client-side `useEffect`. Convert to URL-driven state (`q`, `cat`, `sort`, `page`), which the head-meta and pagination knowledge both require.

- Add `validateSearch` with `fallback` for `q: string=""`, `cat: string=""`, `sort: "newest"|"oldest"` (via `fallback(z.string(), "newest")` then clamp), `page: number=1`.
- Read via `Route.useSearch()`; write via `useNavigate({ from: "/search" })` with `search: (prev) => ({ ...prev, q: value, page: 1 })` — resetting `page` whenever `q`/`cat`/`sort` change.
- Data fetch stays client-side (`useEffect` → `supabase`) so the typing debounce keeps working, but now:
  - Query uses `.select("*, author, category", { count: "exact" })` and `.range(from, to)` with `PAGE_SIZE_SEARCH = 24`.
  - Track `total` in state, compute `totalPages`.
  - Show `Pagination` and a "Showing X–Y of Z" summary.
- Debounce: 250ms on `q` only; `cat`/`sort`/`page` fire immediately.
- Input value is controlled by `q` from URL; `onChange` calls `navigate` (still debounce-friendly because navigate updates the URL synchronously and the effect re-reads it).
- Keep existing `head()` (no per-page canonical needed — search is not indexable; also add `<meta name="robots" content="noindex,follow">` on all search pages to keep query-permutation URLs out of the index).

## SEO notes

- Category and author pagination pages are indexable — Google deprecated `rel=prev/next` as an indexing signal but Bing and other crawlers still use it, and self-referencing `canonical` per page is the current recommended pattern (kept).
- Search results get `noindex,follow` — standard practice, avoids indexing thin query pages.

## Technical details

- `Supabase.range(from, to)` is inclusive on both ends: `from = (page-1) * size`, `to = from + size - 1`.
- `count: "exact"` in the same select returns total via `{ data, count }`; no extra round trip.
- `parsePage` clamps only the lower bound (`Math.max(1, n)`); the loader's `page > totalPages` `notFound()` handles the upper bound so `?page=999` doesn't silently render page 1.
- New route search params are validated with `fallback()` from `@tanstack/zod-adapter` (already installed via zod usage; add if missing).

## Out of scope

- Skills library pagination (deferred per prior discussion).
- Admin table pagination.
- Homepage pagination (curated layout).
