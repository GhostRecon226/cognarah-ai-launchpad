## Problem

Uploaded images in `/admin/media` show a broken image icon. The `media` storage bucket is private (`public = false`), but the code uses `getPublicUrl(...)` — which returns a URL that only works for public buckets. Same URL is embedded into article hero images and Tiptap inline images, so those are broken too.

## Fix

Flip the `media` bucket to public via `supabase--storage_update_bucket(name="media", public=true)`.

Rationale: hero images and inline article images are meant to be publicly viewable on the blog, so public-read is the correct posture. Existing RLS policies on `storage.objects` already restrict write/delete to authorized CMS roles, so making the bucket public only exposes SELECT — which is what we want.

If the workspace policy `cloud_block_public_buckets` rejects it, fallback is to switch `media.tsx`, `articles.$id.tsx`, `tiptap-editor.tsx`, and public article rendering to use `createSignedUrl` — larger change, so only if the flip is blocked.

## Technical

- Single tool call: `supabase--storage_update_bucket(name="media", public=true)`.
- No code changes needed; existing `getPublicUrl` calls will start returning working URLs.
- No migration to `storage.buckets` (that path is unsupported).