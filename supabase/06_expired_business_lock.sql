create function public.account_access() returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.business_members m where m.user_id=auth.uid() and macapp_private.access_until(m.business_id)>now()) then 'active'
 when exists(select 1 from public.business_members m where m.user_id=auth.uid()) or exists(select 1 from macapp_private.trials t where t.owner_id=auth.uid() and t.ends_at<=now()) then 'expired'
 else 'new' end;
$$;
revoke all on function public.account_access() from public,anon;
grant execute on function public.account_access() to authenticated;
alter policy business_read on public.businesses using(public.is_member(id));
alter policy business_create on public.businesses with check(owner_id=auth.uid() and public.account_access()<>'expired');
create or replace function public.accept_staff_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.invites%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión primero';end if;
 select * into i from public.invites where token=p_token and used_by is null and expires_at>now() for update;
 if not found or not coalesce(macapp_private.access_until(i.business_id)>now(),false) then raise exception 'Invitación inválida o vencida';end if;
 insert into public.business_members(business_id,user_id,role) values(i.business_id,(select auth.uid()),'staff') on conflict do nothing;
 update public.invites set used_by=(select auth.uid()) where id=i.id;
 return i.business_id;
end $$;
