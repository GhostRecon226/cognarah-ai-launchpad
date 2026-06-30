## Goal
Add proper role-based access control so only authorized users reach `/admin`, with three roles (admin, editor, author) and an in-CMS UI for admins to grant/revoke roles.

## Roles & permissions

| Capability | Admin | Editor | Author |
|---|---|---|---|
| View dashboard | ✓ | ✓ | ✓ |
| Create/edit own draft articles | ✓ | ✓ | ✓ |
| Edit any article | ✓ | ✓ | — |
| Publish/unpublish articles | ✓ | ✓ | — |
| Delete articles | ✓ | ✓ | — |
| Manage categories & authors | ✓ | ✓ | — |
| Upload media | ✓ | ✓ | ✓ |
| Manage users/roles | ✓ | — | — |
| Manage site settings | ✓ | — | — |
| View newsletter subscribers | ✓ | — | — |

## Database (one migration)
1. Extend `app_role` enum to add `'author'` (keep existing `admin`, `editor`).
2. Add `author_user_id uuid` to `public.articles` (nullable, references `auth.users(id)`), backfilled to NULL. This binds an article to the user who created it so authors can edit "their own".
3. Add helper `public.has_any_role(_user_id uuid, _roles app_role[])` (SECURITY DEFINER, like `has_role`).
4. Rewrite RLS policies:
   - `articles`: admins/editors full access; authors can SELECT/INSERT/UPDATE rows where `author_user_id = auth.uid()` AND `status = 'draft'`; authors cannot DELETE or publish.
   - `categories`, `authors`: admins + editors manage; previously admin-only.
   - `site_settings`, `newsletter_subscribers`: stay admin-only.
   - `user_roles`: admins can INSERT/UPDATE/DELETE (currently no write policies); users still SELECT their own.
5. Storage `media` bucket: allow upload/update for admin/editor/author; delete admin/editor only.
6. Keep the existing trigger that auto-grants admin to `chibuzor_opara15@yahoo.com`. No automatic role for anyone else.

## Route-level guard
- Update `src/components/admin/admin-shell.tsx` to fetch *all* of the current user's roles once, then accept a `requiredRoles?: AppRole[]` prop. If user has none of the required roles, render the existing "Access restricted" page (per your choice).
- Provide a small `useCurrentRoles()` hook (or pass roles via React context from the shell) so admin pages can hide buttons the user can't use (e.g. hide "Delete" / "Publish" for authors, hide Users/Settings nav items for non-admins).
- Per-page required roles:
  - `/admin` (dashboard), `/admin/articles`, `/admin/articles/$id`, `/admin/media`: admin, editor, author
  - `/admin/categories`, `/admin/authors`: admin, editor
  - `/admin/settings`, `/admin/users` (new): admin
- The `_authenticated` layout stays as-is (signed-in gate only); role gating happens in `AdminShell` so the "Access restricted" screen renders with branding instead of a redirect.

## New Users page (`/admin/users`, admin only)
- Lists users from `auth.users` via a `createServerFn` that uses `supabaseAdmin` (service role) and verifies the caller is admin via `requireSupabaseAuth` + `has_role` check.
- Shows email, current roles, last sign-in.
- Admin can grant/revoke `admin`, `editor`, `author` per user (writes to `public.user_roles` from the same server fn).
- Add "Users" entry to the admin sidebar (admin-only).

## Article ownership wiring
- When creating an article in `/admin/articles/$id` (the "new" path), set `author_user_id = auth.uid()`.
- Articles list filters to "my drafts" automatically for users with only the `author` role (RLS will enforce regardless).
- Hide Publish/Delete controls for author-only users.

## Files touched
- `supabase/migrations/<new>.sql` — enum + column + policies + helper.
- `src/components/admin/admin-shell.tsx` — multi-role fetch, `requiredRoles`, role context, conditional nav.
- `src/lib/admin-roles.ts` (new) — `AppRole` type, context, hook.
- `src/lib/admin-users.functions.ts` (new) — list users, grant/revoke role server fns.
- `src/routes/_authenticated/admin/users.tsx` (new).
- `src/routes/_authenticated/admin/index.tsx`, `articles.tsx`, `articles.$id.tsx`, `categories.tsx`, `authors.tsx`, `media.tsx`, `settings.tsx` — pass `requiredRoles` and gate UI affordances.

## Out of scope
- Email-based invite flow (admins grant roles to users who have already signed up).
- Editing roles for the bootstrap admin email.
