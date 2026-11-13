-- MICROAPPS SaaS - Etapas 1-5. Ejecutar UNA vez en Supabase SQL Editor.
-- IMPORTANTE: crea un proyecto de prueba primero. No ejecutes sobre una BD existente.
create extension if not exists pgcrypto;

create table public.businesses (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check (length(name) between 2 and 100),
 slug text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
 phone text, timezone text not null default 'America/Lima', plan text not null default 'free' check(plan in ('free','basic','pro')),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.business_members (
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','staff')),
 created_at timestamptz not null default now(), primary key(business_id,user_id)
);
-- Funciones con SECURITY DEFINER para evitar recursión RLS.
create or replace function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.business_members m where m.business_id=b and m.user_id=(select auth.uid()));
$$;
create or replace function public.is_owner(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.businesses x where x.id=b and x.owner_id=(select auth.uid()));
$$;
revoke all on function public.is_member(uuid),public.is_owner(uuid) from public;
grant execute on function public.is_member(uuid),public.is_owner(uuid) to authenticated;

create or replace function public.add_owner_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.business_members(business_id,user_id,role) values(new.id,new.owner_id,'owner');return new;end $$;
create trigger trg_owner after insert on public.businesses for each row execute function public.add_owner_member();

create table public.invites (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
 expires_at timestamptz not null default now()+interval '7 days', used_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null, phone text not null, email text, visits int not null default 0 check(visits>=0),
 points int not null default 0 check(points>=0), created_at timestamptz not null default now(),
 unique(business_id,phone), unique(business_id,id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null, price numeric(12,2) not null check(price>=0),
 duration_minutes int not null default 30 check(duration_minutes between 10 and 240),
 active boolean not null default true, unique(business_id,id)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 customer_id uuid not null, service_id uuid not null, staff_id uuid,
 starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','confirmed','completed','cancelled')),
 price_snapshot numeric(12,2) not null default 0 check(price_snapshot>=0),
 notes text, created_at timestamptz not null default now(),
 foreign key(business_id,customer_id) references public.customers(business_id,id),
 foreign key(business_id,service_id) references public.services(business_id,id),
 foreign key(business_id,staff_id) references public.business_members(business_id,user_id),
 check(ends_at>starts_at), unique(business_id,id)
);
create index appointments_day on public.appointments(business_id,starts_at);
create table public.cash_entries (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 appointment_id uuid, kind text not null check(kind in ('income','expense')),
 amount numeric(12,2) not null check(amount>0), description text not null,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 foreign key(business_id,appointment_id) references public.appointments(business_id,id)
);
create table public.products (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null, sku text, stock int not null default 0 check(stock>=0),
 min_stock int not null default 3 check(min_stock>=0), unit text not null default 'und',
 cost numeric(12,2) not null default 0 check(cost>=0), unique(business_id,id)
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 product_id uuid not null, delta int not null check(delta<>0), reason text not null,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 foreign key(business_id,product_id) references public.products(business_id,id)
);
create table public.suppliers (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null, phone text, email text, created_at timestamptz not null default now(), unique(business_id,id)
);
create table public.supplier_prices (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 supplier_id uuid not null, product_id uuid not null, price numeric(12,2) not null check(price>=0),
 recorded_at timestamptz not null default now(),
 foreign key(business_id,supplier_id) references public.suppliers(business_id,id),
 foreign key(business_id,product_id) references public.products(business_id,id)
);
create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 supplier_id uuid not null, status text not null default 'draft' check(status in ('draft','sent','received','cancelled')),
 notes text, created_at timestamptz not null default now(),
 foreign key(business_id,supplier_id) references public.suppliers(business_id,id), unique(business_id,id)
);
create table public.purchase_order_items (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 order_id uuid not null, product_id uuid not null, qty int not null check(qty>0),
 unit_price numeric(12,2) not null check(unit_price>=0),
 foreign key(business_id,order_id) references public.purchase_orders(business_id,id) on delete cascade,
 foreign key(business_id,product_id) references public.products(business_id,id)
);

-- Habilitar RLS en TODAS las tablas.
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.invites enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.cash_entries enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_prices enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy business_read on public.businesses for select to authenticated using(public.is_member(id));
create policy business_create on public.businesses for insert to authenticated with check(owner_id=(select auth.uid()));
create policy business_edit on public.businesses for update to authenticated using(public.is_owner(id)) with check(public.is_owner(id) and owner_id=(select auth.uid()));
create policy member_read on public.business_members for select to authenticated using(public.is_member(business_id));
create policy invite_read on public.invites for select to authenticated using(public.is_owner(business_id));

-- Para el MVP, miembros del negocio pueden leer/crear/editar los datos operativos.
create policy customer_read on public.customers for select to authenticated using(public.is_member(business_id));
create policy customer_insert on public.customers for insert to authenticated with check(public.is_member(business_id));
create policy customer_update on public.customers for update to authenticated using(public.is_member(business_id)) with check(public.is_member(business_id));
create policy service_read on public.services for select to authenticated using(public.is_member(business_id));
create policy service_insert on public.services for insert to authenticated with check(public.is_member(business_id));
create policy service_update on public.services for update to authenticated using(public.is_member(business_id)) with check(public.is_member(business_id));
create policy appointment_read on public.appointments for select to authenticated using(public.is_member(business_id));
create policy appointment_insert on public.appointments for insert to authenticated with check(public.is_member(business_id));
create policy appointment_update on public.appointments for update to authenticated using(public.is_member(business_id)) with check(public.is_member(business_id));
create policy cash_read on public.cash_entries for select to authenticated using(public.is_member(business_id));
create policy cash_insert on public.cash_entries for insert to authenticated with check(public.is_member(business_id));
create policy product_read on public.products for select to authenticated using(public.is_member(business_id));
create policy product_insert on public.products for insert to authenticated with check(public.is_member(business_id));
create policy product_update on public.products for update to authenticated using(public.is_member(business_id)) with check(public.is_member(business_id));
create policy movement_read on public.stock_movements for select to authenticated using(public.is_member(business_id));
create policy supplier_read on public.suppliers for select to authenticated using(public.is_member(business_id));
create policy supplier_insert on public.suppliers for insert to authenticated with check(public.is_member(business_id));
create policy supplier_update on public.suppliers for update to authenticated using(public.is_member(business_id)) with check(public.is_member(business_id));
create policy price_read on public.supplier_prices for select to authenticated using(public.is_member(business_id));
create policy price_insert on public.supplier_prices for insert to authenticated with check(public.is_member(business_id));
create policy po_read on public.purchase_orders for select to authenticated using(public.is_member(business_id));
create policy po_insert on public.purchase_orders for insert to authenticated with check(public.is_member(business_id));
create policy po_update on public.purchase_orders for update to authenticated using(public.is_member(business_id)) with check(public.is_member(business_id));
create policy poi_read on public.purchase_order_items for select to authenticated using(public.is_member(business_id));
create policy poi_insert on public.purchase_order_items for insert to authenticated with check(public.is_member(business_id));

-- RPC: invitaciones seguras para empleados (token aleatorio, un solo uso).
create or replace function public.create_staff_invite(p_business uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
 if not public.is_owner(p_business) then raise exception 'Solo el dueño puede invitar';end if;
 insert into public.invites(business_id) values(p_business) returning token into t;
 return t;
end $$;
create or replace function public.accept_staff_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.invites%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión primero';end if;
 select * into i from public.invites where token=p_token and used_by is null and expires_at>now() for update;
 if not found then raise exception 'Invitación inválida o vencida';end if;
 insert into public.business_members(business_id,user_id,role) values(i.business_id,(select auth.uid()),'staff') on conflict do nothing;
 update public.invites set used_by=(select auth.uid()) where id=i.id;
 return i.business_id;
end $$;

-- RPC: registrar movimientos de stock sin permitir stock negativo.
create or replace function public.move_stock(p_business uuid,p_product uuid,p_delta int,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_member(p_business) then raise exception 'Acceso denegado';end if;
 if p_delta=0 or length(trim(coalesce(p_reason,'')))<2 then raise exception 'Movimiento inválido';end if;
 update public.products set stock=stock+p_delta where id=p_product and business_id=p_business and stock+p_delta>=0;
 if not found then raise exception 'Producto inexistente o stock insuficiente';end if;
 insert into public.stock_movements(business_id,product_id,delta,reason,created_by) values(p_business,p_product,p_delta,p_reason,(select auth.uid()));
end $$;

-- RPC: finalizar una cita una sola vez, sumar fidelidad y registrar ingreso.
create or replace function public.complete_appointment(p_business uuid,p_appointment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.appointments%rowtype;
begin
 if not public.is_member(p_business) then raise exception 'Acceso denegado';end if;
 select * into a from public.appointments where id=p_appointment and business_id=p_business for update;
 if not found or a.status not in ('pending','confirmed') then raise exception 'La cita no se puede completar';end if;
 update public.appointments set status='completed' where id=a.id;
 update public.customers set visits=visits+1,points=points+1 where id=a.customer_id and business_id=p_business;
 if a.price_snapshot>0 then
 insert into public.cash_entries(business_id,appointment_id,kind,amount,description,created_by)
 values(p_business,a.id,'income',a.price_snapshot,'Servicio completado',(select auth.uid()));
 end if;
end $$;

-- RPC público: sólo devuelve información publicada, nunca datos de clientes.
create or replace function public.get_public_booking_info(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'phone',b.phone,
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'price',s.price,'duration_minutes',s.duration_minutes) order by s.name)
 from public.services s where s.business_id=b.id and s.active), '[]'::jsonb))
 from public.businesses b where b.slug=p_slug and b.active;
$$;

-- RPC público: reserva sin registro, control horario, validación, límite sencillo y bloqueo de concurrencia.
-- Horario piloto fijo: 09:00-20:00 America/Lima. No enviar secretos desde el frontend.
create or replace function public.create_public_booking(p_slug text,p_service uuid,p_name text,p_phone text,p_starts timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.businesses%rowtype; s public.services%rowtype; c uuid; a uuid; fin timestamptz; local_start timestamp;
begin
 select * into b from public.businesses where slug=p_slug and active;
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

-- Evitar que usuarios autenticados alteren datos financieros y fidelidad directamente mediante UPDATE de cliente.
-- En producción: endurecer permisos por columna, límites por plan en backend y protección anti-bots.
revoke all on function public.create_staff_invite(uuid),public.accept_staff_invite(text),public.move_stock(uuid,uuid,int,text),public.complete_appointment(uuid,uuid) from public;
grant execute on function public.create_staff_invite(uuid),public.accept_staff_invite(text),public.move_stock(uuid,uuid,int,text),public.complete_appointment(uuid,uuid) to authenticated;
revoke all on function public.get_public_booking_info(text),public.create_public_booking(text,uuid,text,text,timestamptz) from public;
grant execute on function public.get_public_booking_info(text),public.create_public_booking(text,uuid,text,text,timestamptz) to anon,authenticated;
