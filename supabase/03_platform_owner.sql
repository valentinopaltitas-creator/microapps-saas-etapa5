-- Set macapp.owner_uid to the verified pilot owner's UUID before applying.
create schema if not exists macapp_private;
create table macapp_private.platform_owner (singleton boolean primary key default true check(singleton), user_id uuid not null unique references auth.users(id));
revoke all on schema macapp_private from public,anon,authenticated;
revoke all on macapp_private.platform_owner from public,anon,authenticated;
do $$ declare owner_uid uuid; begin
select id into strict owner_uid from auth.users where id=nullif(current_setting('macapp.owner_uid',true),'')::uuid and email_confirmed_at is not null;
insert into macapp_private.platform_owner(user_id) values(owner_uid);
end $$;
create function public.platform_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
if not exists(select 1 from macapp_private.platform_owner where user_id=auth.uid()) then raise exception 'Acceso restringido' using errcode='42501'; end if;
return coalesce((select jsonb_agg(to_jsonb(summary) order by summary.name) from (
select b.name,b.slug,b.plan,b.active,coalesce(sum(c.amount) filter(where c.kind='income'),0) income,coalesce(sum(c.amount) filter(where c.kind='expense'),0) expenses from public.businesses b left join public.cash_entries c on c.business_id=b.id group by b.id
) summary),'[]'::jsonb);
end $$;
revoke all on function public.platform_overview() from public,anon,authenticated;
grant execute on function public.platform_overview() to authenticated;
