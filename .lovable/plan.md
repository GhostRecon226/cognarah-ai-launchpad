## Diagnosis

Your account (`chibuzor_opara15@yahoo.com`) is in the database with the `admin` role. RLS on `user_roles` lets a user read their own rows, so the query in `AdminShell` should return `[{ role: "admin" }]`. The "Access restricted" page only renders when that query returns `[]`.

The most likely cause is a **stale tab**: the shell fetched roles once on mount, before/around the moment the setup flow granted the role, and never refetched. A hard refresh should clear it.

## Hardening (small, safe changes)

If the issue is not just staleness, or to prevent it from recurring, make `AdminShell` resilient:

1. **Refetch roles on auth state changes.** Subscribe to `supabase.auth.onAuthStateChange` and re-run the `user_roles` query on `SIGNED_IN`, `TOKEN_REFRESHED`, and `USER_UPDATED`. Unsubscribe on unmount.
2. **Add a "Retry" button to the "Access restricted" screen.** Re-runs the role fetch in place (no full reload), so a freshly granted role becomes visible without signing out.
3. **Log the actual fetch result on failure.** If `supabase.from("user_roles").select(...)` returns an `error`, surface it under the "Access restricted" message (small muted text) so future RLS/network issues are diagnosable instead of silently showing "no role".
4. **Wire the missing trigger** for `public.handle_new_user_role` on `auth.users` insert. The function exists but no trigger calls it, so the "auto-grant admin to the configured email on signup" behaviour never runs. Add the trigger so new signups with the admin email are auto-granted (matching what the function was written for).

### Files touched

- `src/components/admin/admin-shell.tsx` — add `onAuthStateChange` refetch, expose a `refetchRoles()` and a Retry button on the restricted screen, surface fetch errors.
- New migration — `CREATE TRIGGER on_auth_user_created_grant_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();`

No changes to routes, RLS policies, or the setup/reset flows.

## What to try first

Hard refresh `/admin`. If the Dashboard loads, no code change is needed — the staleness is already gone for your session, and step 1–3 above just prevent it from happening to anyone again. Tell me which you want:

- **A.** Apply the hardening (steps 1–4) now.
- **B.** Just add the missing trigger (step 4) and skip the shell changes.
- **C.** Hold off — the refresh fixed it.
