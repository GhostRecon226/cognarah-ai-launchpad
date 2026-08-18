create role rls_test_role;
create table public.rls_probe(id int);
insert into public.rls_probe values (1);
grant select on public.rls_probe to rls_test_role;
create or replace function public.rls_probe_fn() returns boolean language sql stable security definer set search_path=public as $$ select true $$;
revoke execute on function public.rls_probe_fn() from public, rls_test_role;
alter table public.rls_probe enable row level security;
create policy p on public.rls_probe for select using (public.rls_probe_fn());