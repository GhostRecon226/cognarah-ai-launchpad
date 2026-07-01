## Problem

`/admin/articles` crashes with `useRoles must be used inside AdminShell` (visible in console logs). The `ArticlesList` component calls `useRoles()` at its top level, but `AdminShell` (which provides the roles context) is rendered *inside* its return — so the hook runs before the provider exists.

The articles table is fine (it exists, with all needed columns) and Supabase is connected. This is purely a component-structure bug — the same pattern that was fixed previously for the edit page, but `articles.index.tsx` was left in the broken shape.

## Fix

Refactor `src/routes/_authenticated/admin/articles.index.tsx` so `useRoles()` is called from an inner component wrapped by `AdminShell`:

```
function ArticlesList() {
  return (
    <AdminShell title="Articles">
      <ArticlesListInner />
    </AdminShell>
  );
}

function ArticlesListInner() {
  const { hasAny } = useRoles();
  // ...existing state, load(), del(), and JSX (minus the AdminShell wrapper)
}
```

No other files change. No DB changes — the `articles` table and all referenced columns already exist.

## Out of scope

- Adding a `source_url` column or recreating the `articles` table: current schema already has `source_urls text[]` used by the agent; a scalar `source_url` isn't needed and would conflict.
- Broader error-boundary work: the route already inherits `errorComponent` from the root; once the context bug is fixed the page renders normally (including the existing empty-state row "No articles yet.").
