## Plan

Add per-article view counts, incremented on each public article page load, and shown in the admin articles list.

### 1. Database

Migration:
- Add `view_count integer NOT NULL DEFAULT 0` to `public.articles`.
- Create `public.increment_article_views(_slug text)` — SECURITY DEFINER, `SET search_path = public`. Updates `view_count = view_count + 1` where `slug = _slug AND status = 'published'`. Returns void.
- `GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO anon, authenticated;`

Using an RPC avoids needing a broad UPDATE RLS policy on `articles` and works for anonymous readers.

### 2. Increment on article load

In `src/routes/article.$slug.tsx`, inside `loadArticle`, after confirming the article exists, call:

```ts
await supabase.rpc("increment_article_views", { _slug: slug });
```

Fire-and-forget style (wrapped so an error can't break the page load). Runs during the loader on both SSR and client navigations — each page load counts once. No dedupe (matches the "each time the article page is loaded" spec).

### 3. Admin list display

In `src/routes/_authenticated/admin/articles.index.tsx`:
- Add `view_count` to the select and to the `Row` interface.
- Add a "Views" column between Status and Updated, right-aligned numeric, formatted with `toLocaleString()`.

### 4. Types

Add `view_count: number` to the `Article` interface in `src/lib/types.ts`. Supabase `types.ts` is auto-regenerated after the migration.

### Out of scope

- Deduping views per session/IP.
- Analytics dashboards, trending sorts, or public view badges on article cards.
