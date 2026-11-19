create table macapp_private.trials(owner_id uuid primary key references auth.users(id), ends_at timestamptz not null);
insert into macapp_private.trials select owner_id,min(created_at)+interval '1 month' from public.businesses group by owner_id;
create table macapp_private.paid_access(business_id uuid primary key references public.businesses(id), paid_until timestamptz not null);
revoke all on macapp_private.trials,macapp_private.paid_access from public,anon,authenticated;
create function macapp_private.start_trial() returns trigger language plpgsql security definer set search_path='' as $$ begin
insert into macapp_private.trials values(new.owner_id,now()+interval '1 month') on conflict do nothing;
return new; end $$;
create trigger start_macapp_trial after insert on public.businesses for each row execute function macapp_private.start_trial();
create function macapp_private.access_until(b uuid) returns timestamptz language sql stable security definer set search_path='' as $$
select greatest(t.ends_at,p.paid_until) from public.businesses x join macapp_private.trials t on t.owner_id=x.owner_id left join macapp_private.paid_access p on p.business_id=x.id where x.id=b;
$$;
revoke all on function macapp_private.start_trial(),macapp_private.access_until(uuid) from public,anon,authenticated;
create or replace function public.is_member(b uuid) returns boolean language sql stable security definer set search_path='' as $$
select macapp_private.access_until(b)>now() and exists(select 1 from public.business_members m where m.business_id=b and m.user_id=auth.uid());
$$;
create or replace function public.is_owner(b uuid) returns boolean language sql stable security definer set search_path='' as $$
select macapp_private.access_until(b)>now() and exists(select 1 from public.businesses x where x.id=b and x.owner_id=auth.uid());
$$;
drop policy business_read on public.businesses;
create policy business_read on public.businesses for select to authenticated using(owner_id=(select auth.uid()) or public.is_member(id));
create function public.my_access_until(b uuid) returns timestamptz language sql stable security definer set search_path='' as $$
select macapp_private.access_until(b) where exists(select 1 from public.business_members m where m.business_id=b and m.user_id=auth.uid());
$$;
revoke all on function public.my_access_until(uuid) from public,anon;
grant execute on function public.my_access_until(uuid) to authenticated;
create or replace function public.get_public_booking_info(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'phone',b.phone,
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'price',s.price,'duration_minutes',s.duration_minutes) order by s.name)
 from public.services s where s.business_id=b.id and s.active), '[]'::jsonb))
 from public.businesses b where b.slug=p_slug and b.active and macapp_private.access_until(b.id)>now();
$$;

-- RPC público: reserva sin registro, control horario, validación, límite sencillo y bloqueo de concurrencia.
-- Horario piloto fijo: 09:00-20:00 America/Lima. No enviar secretos desde el frontend.
create or replace function public.create_public_booking(p_slug text,p_service uuid,p_name text,p_phone text,p_starts timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.businesses%rowtype; s public.services%rowtype; c uuid; a uuid; fin timestamptz; local_start timestamp;
begin
 select * into b from public.businesses where slug=p_slug and active and macapp_private.access_until(id)>now();
 if not found then raise exception 'Negocio no disponible';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 100 or length(trim(coalesce(p_phone,''))) not between 7 and 20 then raise exception 'Nombre o teléfono inválidos';end if;
 if p_starts is null or p_starts<now()+interval '1 hour' or p_starts>now()+interval '90 days' then raise exception 'Selecciona una fecha válida (mínimo 1 hora de anticipación)';end if;
 select * into s from public.services where id=p_service and business_id=b.id and active;
 if not found then raise exception 'Servicio inválido';end if;
 fin:=p_starts+make_interval(mins=>s.duration_minutes);
 local_start:=p_starts at time zone 'America/Lima';
 if extract(isodow from local_start)=7 or local_start::time<time '09:00' or (fin at time zone 'America/Lima')::date<>local_start::date or (fin at time zone 'America/Lima')::time>time '20:00' then raise exception 'Horario piloto: lunes a sábado, 09:00 a 20:00';end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text,0));
 if exists(select 1 from public.appointments x where x.business_id=b.id and x.status in ('pending','confirmed') and x.starts_at<fin and x.ends_at>p_starts) then raise exception 'Horario ocupado. Elige otra hora';end if;
 if (select count(*) from public.appointments x join public.customers y on y.id=x.customer_id and y.business_id=x.business_id
     where x.business_id=b.id and y.phone=trim(p_phone) and x.created_at>now()-interval '1 day')>=3 then raise exception 'Límite diario de reservas alcanzado';end if;
 insert into public.customers(business_id,name,phone) values(b.id,trim(p_name),trim(p_phone))
 on conflict(business_id,phone) do update set name=excluded.name returning id into c;
 insert into public.appointments(business_id,customer_id,service_id,starts_at,ends_at,price_snapshot,status)
 values(b.id,c,s.id,p_starts,fin,s.price,'pending') returning id into a;
 return a;
end $$;
