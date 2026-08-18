-- cleanup probe artifacts from previous test
drop policy if exists p on public.rls_probe;
drop table if exists public.rls_probe;
drop function if exists public.rls_probe_fn();
drop role if exists rls_test_role;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function private.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
revoke all on function private.has_any_role(uuid, public.app_role[]) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function private.has_any_role(uuid, public.app_role[]) to authenticated, service_role;

-- public wrappers become SECURITY INVOKER so no privileged function is exposed on the API schema
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security invoker set search_path = public as $$
  select private.has_role(_user_id, _role)
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security invoker set search_path = public as $$
  select private.has_any_role(_user_id, _roles)
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.has_any_role(uuid, public.app_role[]) to authenticated, service_role;