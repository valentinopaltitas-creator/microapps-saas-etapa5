create table macapp_private.subscription_receipts (
 reference text primary key, business_id uuid not null references public.businesses(id),
 period integer not null, amount integer not null, ends_at timestamptz not null,
 recorded_at timestamptz not null default now(), recorded_by uuid not null, unique(business_id,period)
);
revoke all on macapp_private.subscription_receipts from public,anon,authenticated;
create function public.record_subscription(p_business uuid,p_reference text,p_period integer,p_amount integer) returns timestamptz language plpgsql security definer set search_path='' as $$
declare ref text:=lower(trim(p_reference)); n integer; price integer; expiry timestamptz; prior macapp_private.subscription_receipts%rowtype;
begin
 if not exists(select 1 from macapp_private.platform_owner where user_id=auth.uid()) then raise insufficient_privilege; end if;
 if ref is null or length(ref) not between 3 and 100 then raise exception 'Referencia inválida'; end if;
 perform 1 from public.businesses where id=p_business for update;
 if not found then raise exception 'Barbería inexistente'; end if;
 select * into prior from macapp_private.subscription_receipts where reference=ref;
 if found then
 if prior.business_id=p_business and prior.period=p_period and prior.amount=p_amount then return prior.ends_at; end if;
 raise exception 'Referencia ya registrada';
 end if;
 select count(*)+1 into n from macapp_private.subscription_receipts where business_id=p_business;
 price:=macapp_private.monthly_price(n);
 if p_period is distinct from n or p_amount is distinct from price then raise exception 'Revisa el mes y el importe antes de registrar el pago';end if;
 expiry:=greatest(now(),macapp_private.access_until(p_business))+interval '1 month';
 insert into macapp_private.subscription_receipts(reference,business_id,period,amount,ends_at,recorded_by) values(ref,p_business,n,price,expiry,auth.uid());
 insert into macapp_private.paid_access values(p_business,expiry) on conflict(business_id) do update set paid_until=excluded.paid_until;
 return expiry;
end $$;
revoke all on function public.record_subscription(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.record_subscription(uuid,text,integer,integer) to authenticated;
create or replace function public.platform_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from macapp_private.platform_owner where user_id=auth.uid()) then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from (
 select b.id,b.name,b.slug,b.active,macapp_private.access_until(b.id) as expiry,
 p.n+1 as next_period,macapp_private.monthly_price((p.n+1)::int) as price,p.total,
 coalesce(sum(c.amount) filter(where c.kind='income'),0) income,coalesce(sum(c.amount) filter(where c.kind='expense'),0) expenses
 from public.businesses b cross join lateral(select count(*) n,coalesce(sum(amount),0) total from macapp_private.subscription_receipts r where r.business_id=b.id) p
 left join public.cash_entries c on c.business_id=b.id group by b.id,p.n,p.total
 ) s),'[]'::jsonb);
end $$;
