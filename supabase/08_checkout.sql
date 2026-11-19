create function public.renewal_options() returns table(business_id uuid,name text,period integer,amount integer) language sql stable security definer set search_path='' as $$
select b.id,b.name,n.period,macapp_private.monthly_price(n.period) from public.businesses b cross join lateral(select count(*)::int+1 period from macapp_private.subscription_receipts r where r.business_id=b.id)n where b.owner_id=auth.uid() order by b.name;
$$;
revoke all on function public.renewal_options() from public,anon;
grant execute on function public.renewal_options() to authenticated;
create function public.apply_mp_payment(b uuid,p integer,a integer,payment_id text) returns void language plpgsql security definer set search_path='' as $$
declare expiry timestamptz; owner_uid uuid; ref text:='mercadopago:'||payment_id;
begin
select owner_id into strict owner_uid from public.businesses where id=b for update;
if payment_id is null or payment_id !~ '^[0-9]+$' then raise exception 'Pago inválido';end if;
if exists(select 1 from macapp_private.subscription_receipts where reference=ref and business_id=b and period=p and amount=a) then return;end if;
if p is distinct from (select count(*)+1 from macapp_private.subscription_receipts where business_id=b) or a is distinct from macapp_private.monthly_price(p) then raise exception 'Pago requiere conciliación';end if;
expiry:=greatest(now(),macapp_private.access_until(b))+interval '1 month';
insert into macapp_private.subscription_receipts(reference,business_id,period,amount,ends_at,recorded_by) values(ref,b,p,a,expiry,owner_uid);
insert into macapp_private.paid_access values(b,expiry) on conflict(business_id) do update set paid_until=excluded.paid_until;
end $$;
revoke all on function public.apply_mp_payment(uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.apply_mp_payment(uuid,integer,integer,text) to service_role;
