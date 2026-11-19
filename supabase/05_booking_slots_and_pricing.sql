create function public.booking_slots(p_slug text,p_service uuid,p_day date) returns table(starts_at timestamptz)
language sql stable security definer set search_path='' as $$
select slot from public.businesses b join public.services s on s.business_id=b.id
cross join lateral generate_series((p_day+time '09:00') at time zone 'America/Lima',
((p_day+time '20:00') at time zone 'America/Lima')-make_interval(mins=>s.duration_minutes),interval '30 minutes') slot
where b.slug=p_slug and b.active and s.id=p_service and s.active and macapp_private.access_until(b.id)>now()
and extract(isodow from p_day)<7 and slot between now()+interval '1 hour' and now()+interval '90 days'
and not exists(select 1 from public.appointments a where a.business_id=b.id and a.status in ('pending','confirmed') and a.starts_at<slot+make_interval(mins=>s.duration_minutes) and a.ends_at>slot)
order by slot;
$$;
revoke all on function public.booking_slots(text,uuid,date) from public;
grant execute on function public.booking_slots(text,uuid,date) to anon,authenticated;
create function macapp_private.monthly_price(p_paid_month integer) returns integer language sql immutable strict set search_path='' as $$
 select case when p_paid_month between 1 and 2 then 50 when p_paid_month>=3 then 80 end;
$$;
revoke all on function macapp_private.monthly_price(integer) from public,anon,authenticated;
