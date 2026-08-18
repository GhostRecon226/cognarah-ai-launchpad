revoke execute on function public.has_role(uuid, app_role) from authenticated, anon, public;
revoke execute on function public.has_any_role(uuid, app_role[]) from authenticated, anon, public;
grant execute on function public.has_role(uuid, app_role) to service_role;
grant execute on function public.has_any_role(uuid, app_role[]) to service_role;