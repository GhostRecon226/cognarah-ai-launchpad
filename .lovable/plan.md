# Mobile responsiveness audit & fixes

I scanned every page at 375px (mobile) and 768px (tablet). Good news: no horizontal scroll anywhere — the global layout is sound. The issues are smaller polish problems plus one real gap: the admin CMS has no mobile navigation at all.

## What I found

### Public pages
- **Homepage** — works, but headline `text-3xl` on the lead hero is a bit cramped at 375px (the `text-4xl sm:` jump happens at 640px). Tighten to `text-[28px]`/`text-3xl sm:text-4xl lg:text-5xl`. The Africa AI Spotlight has `marginTop: 60px` inline — keep on desktop, drop to ~32px on mobile so the band doesn't float in dead space.
- **Article page** — `text-4xl sm:text-5xl` H1 is loud on small phones; step down to `text-3xl sm:text-4xl lg:text-5xl`. Body prose font-size 1.125rem is fine; confirm long inline code/URLs don't overflow by adding `overflow-wrap: anywhere` to `.prose-article`.
- **Category page** — same H1 sizing pass as article. Hero section padding `py-16` is heavy on mobile → `py-10 sm:py-16`.
- **Search page** — filter row stacks correctly, but the two `<select>`s don't shrink (no `min-w-0`) and on a tight 360-ish viewport between the input + selects it can feel cramped. Make selects full-width on mobile (`w-full sm:w-auto`) and keep them on their own row.
- **About page** — "What we cover" uses `grid-cols-2` on every breakpoint; at 320–360px the category pills can squeeze. Use `grid-cols-1 sm:grid-cols-2`.
- **Newsletter** — already stacks correctly; no change.
- **Footer** — already responsive; no change.
- **Nav** — already has mobile hamburger + accordion; no change.

### Admin CMS (currently desktop-only)
- `AdminShell` hides the sidebar with `hidden md:flex` and provides **no** mobile menu — admin is unusable below 768px. Add a hamburger button in the admin header that opens the nav as a `Sheet` (slide-in drawer) on mobile. Keep desktop sidebar unchanged.
- **Articles list table** — `<table>` will overflow on mobile. Wrap in `overflow-x-auto` so it can scroll horizontally rather than break the layout.
- **Article editor** (`articles.$id.tsx`) — two-column form layouts need `grid-cols-1 lg:grid-cols-X` audit; Tiptap toolbar should wrap (`flex-wrap`).
- **Media / Categories / Authors / Settings** — quick audit pass for the same patterns (tables → scroll wrapper, form grids → stack on mobile, action buttons → wrap).

### Auth page
- Quick check + ensure the form card is full-width with comfortable padding on small screens.

## Changes

Files to edit:
- `src/routes/index.tsx` — hero headline sizing, spotlight top margin responsive.
- `src/routes/article.$slug.tsx` — H1 sizing.
- `src/routes/category.$slug.tsx` — H1 + hero padding.
- `src/routes/search.tsx` — filter row: selects full-width on mobile.
- `src/routes/about.tsx` — "What we cover" grid stacks on mobile.
- `src/routes/auth.tsx` — verify + minor padding tweaks.
- `src/styles.css` — add `overflow-wrap: anywhere` to `.prose-article` and to long-word containers.
- `src/components/admin/admin-shell.tsx` — add mobile hamburger + `Sheet`-based nav drawer; ensure header is sticky and tappable.
- `src/routes/_authenticated/admin/articles.tsx` — wrap table in `overflow-x-auto` container.
- `src/routes/_authenticated/admin/articles.$id.tsx` — stack form grid, wrap Tiptap toolbar, ensure inputs are `w-full`.
- `src/routes/_authenticated/admin/categories.tsx`, `authors.tsx`, `media.tsx`, `settings.tsx`, `index.tsx` — pass for table scroll wrappers, grid stacking, button wrapping.

No content, copy, data, or behavior changes — purely presentation/responsive classes.

## Verification

After implementing, I'll re-run the Playwright sweep at 375px and 768px across home / about / search / category / article / auth / admin / admin/articles / admin/articles/:id and confirm no horizontal scroll and that all interactive elements are reachable on mobile.
