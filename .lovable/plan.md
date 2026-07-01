# Signed URLs for the private `media` bucket

Keep the `media` bucket private and serve every image through a stable app URL that redirects to a fresh signed URL on each request. This way stored URLs never expire and nothing in the DB needs re-migration when tokens rotate.

## 1. New public server route: `/api/public/media/$`

File: `src/routes/api/public/media.$.ts`

- `GET` handler takes the splat as the storage path (e.g. `hero/abc.jpg`).
- Loads `supabaseAdmin` inside the handler and calls `storage.from("media").createSignedUrl(path, 3600)`.
- Returns `302` redirect to the signed URL with `Cache-Control: public, max-age=1800` so browsers/CDN reuse the redirect for 30 min (well under the 1h signature).
- 404 on missing path or Supabase error.

This is safe to expose publicly: it only serves objects from the `media` bucket, which we already intended to be publicly viewable.

## 2. Store stable paths on upload

Replace every `getPublicUrl(path).data.publicUrl` with `/api/public/media/${path}` in:

- `src/components/admin/tiptap-editor.tsx` (inline image insert)
- `src/routes/_authenticated/admin/articles.$id.tsx` (cover image upload)
- `src/routes/_authenticated/admin/media.tsx` (media library previews)

Upload calls themselves stay the same.

## 3. Backward-compat for existing DB rows

Some articles/cover images may already contain the old `.../storage/v1/object/public/media/<path>` URLs. Add a tiny helper:

```ts
// src/lib/media-url.ts
export function mediaUrl(input?: string | null): string {
  if (!input) return "";
  const m = input.match(/\/storage\/v1\/object\/(?:public|sign)\/media\/([^?]+)/);
  if (m) return `/api/public/media/${m[1]}`;
  return input;
}
```

Use `mediaUrl(...)` when rendering:
- article cover images on home, category, article, search pages
- inline `<img src>` inside article HTML — sanitize step already runs; extend `src/lib/sanitize.ts` to rewrite `src` attributes through `mediaUrl` after sanitization.

## 4. No bucket change required

Bucket stays private, so no workspace policy change is needed. If public buckets ever get enabled later, this route keeps working unchanged.

## Technical notes

- `supabaseAdmin` must be loaded via `await import("@/integrations/supabase/client.server")` inside the handler (route files are client-reachable).
- `/api/public/*` bypasses auth on published sites — intentional here.
- Redirect (302) rather than proxying bytes keeps the Worker cheap and lets the browser/CDN cache the image directly from Supabase.
