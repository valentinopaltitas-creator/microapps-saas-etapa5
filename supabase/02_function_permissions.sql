revoke execute on function public.is_member(uuid), public.is_owner(uuid), public.create_staff_invite(uuid), public.accept_staff_invite(text), public.move_stock(uuid,uuid,integer,text), public.complete_appointment(uuid,uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.create_staff_invite(uuid), public.accept_staff_invite(text), public.move_stock(uuid,uuid,integer,text), public.complete_appointment(uuid,uuid) to authenticated;
revoke execute on function public.add_owner_member() from public, anon, authenticated;
do $$ begin if to_regprocedure('public.rls_auto_enable()') is not null then revoke execute on function public.rls_auto_enable() from public, anon, authenticated; end if; end $$;
