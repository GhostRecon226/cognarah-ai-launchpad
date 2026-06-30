## Problem

Your account already has the `admin` role. The CMS still fails because a prior "lock down" migration revoked EXECUTE on `public.has_role` and `public.has_any_role` from PUBLIC/authenticated. Every RLS policy on `articles`, `user_roles`, storage, etc. calls one of these SECURITY DEFINER functions, so the Data API returns:

```
permission denied for function has_role
permission denied for function has_any_role
```

That's why `/admin` shows access denied even though the row exists in `user_roles`.

## Fix

One migration that re-grants EXECUTE to `authenticated` (and `anon` where needed by public-read policies) on both helper functions. They're already `SECURITY DEFINER` with a pinned `search_path`, so they remain safe to expose — granting EXECUTE only lets callers ask "does user X have role Y?", not read the table directly.

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, anon;
```

## Verify

After approval, hard-refresh `/admin`. The dashboard stat queries and role lookup should return 200 and the admin shell should load.
