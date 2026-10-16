-- Payments retain their actual currency; allocations freeze the original debts cleared.
alter table bonado.settlements add column currency text;
alter table bonado.settlements add column exchange_rate_to_trip_default numeric not null default 1;
alter table bonado.settlements add column allocations jsonb;
update bonado.settlements s set currency = t.default_currency
from bonado.trips t where t.id = s.trip_id;
alter table bonado.settlements alter column currency set not null;
alter table bonado.settlements add constraint settlement_currency_code check (currency ~ '^[A-Z]{3}$');
alter table bonado.settlements add constraint settlement_positive_rate check (exchange_rate_to_trip_default > 0);

-- Null allocations identify historical/default-currency payments. New payments always
-- have explicit allocations, including overpayments in their payment currency.
create function bonado.trip_currency_balances_internal(p_trip_id uuid, p_exclude_settlement_id uuid default null)
returns table(user_id uuid, currency text, balance numeric)
language sql stable security definer set search_path = bonado as $$
  with lines as (
    select p.user_id, e.currency, p.amount_paid amount
    from payments p join entries e on e.id = p.entry_id
    where e.trip_id = p_trip_id and e.status = 'active'
    union all
    select s.user_id, e.currency, -s.owed_amount
    from line_item_shares s join line_items i on i.id = s.line_item_id
    join entries e on e.id = i.entry_id where e.trip_id = p_trip_id and e.status = 'active'
    union all
    select s.user_id, e.currency, -s.owed_amount
    from adjustment_shares s join adjustments a on a.id = s.adjustment_id
    join entries e on e.id = a.entry_id where e.trip_id = p_trip_id and e.status = 'active'
    union all
    select person.user_id, a->>'currency', (a->>'amount')::numeric * person.sign
    from settlements s
    cross join lateral jsonb_array_elements(coalesce(s.allocations,
      jsonb_build_array(jsonb_build_object('currency',s.currency,'amount',s.amount)))) a
    cross join lateral (values (s.from_user_id,1),(s.to_user_id,-1)) person(user_id,sign)
    where s.trip_id = p_trip_id and s.id is distinct from p_exclude_settlement_id
  )
  select l.user_id, l.currency, round(sum(l.amount),2) from lines l
  group by l.user_id,l.currency having round(sum(l.amount),2) <> 0
$$;
revoke all on function bonado.trip_currency_balances_internal(uuid,uuid) from public,anon,authenticated;
create function bonado.get_trip_currency_balances(p_trip_id uuid,p_exclude_settlement_id uuid default null)
returns table(user_id uuid,currency text,balance numeric)
language sql stable security definer set search_path=bonado as $$
  select * from bonado.trip_currency_balances_internal(p_trip_id,p_exclude_settlement_id)
  where bonado.is_trip_member(p_trip_id)
$$;
revoke all on function bonado.get_trip_currency_balances(uuid,uuid) from public, anon;
grant execute on function bonado.get_trip_currency_balances(uuid,uuid) to authenticated;

-- Every currency has one display valuation. Applying it AFTER native netting
-- prevents same-currency expenses at different FX snapshots leaving phantom debts.
create function bonado.balance_currency_rate(p_trip_id uuid, p_currency text)
returns numeric language sql stable security definer set search_path = bonado as $$
  select case when t.default_currency = p_currency then 1 else coalesce(
    (select 1 / c.rate from exchange_rate_cache c where c.base_currency=t.default_currency and c.target_currency=p_currency),
    (select e.exchange_rate_to_trip_default from entries e where e.trip_id=t.id and e.currency=p_currency order by e.created_at desc,e.id desc limit 1),
    (select s.exchange_rate_to_trip_default from settlements s where s.trip_id=t.id and s.currency=p_currency order by s.created_at desc,s.id desc limit 1)
  ) end from trips t where t.id=p_trip_id and bonado.is_trip_member(p_trip_id)
$$;
revoke all on function bonado.balance_currency_rate(uuid,text) from public, anon;

create function bonado.get_trip_balances_v2(p_trip_id uuid)
returns table(user_id uuid, balance numeric, has_estimated_rates boolean, has_activity boolean, currency_balances jsonb)
language sql stable security definer set search_path = bonado as $$
  with native as (select * from bonado.get_trip_currency_balances(p_trip_id))
  select m.user_id, coalesce(round(sum(n.balance * bonado.balance_currency_rate(p_trip_id,n.currency)),2),0),
    exists(select 1 from entries where trip_id=p_trip_id and status='active' and rate_is_estimated),
    (exists(select 1 from entries where trip_id=p_trip_id and status='active') or exists(select 1 from settlements where trip_id=p_trip_id)),
    coalesce(jsonb_object_agg(n.currency,n.balance) filter(where n.currency is not null),'{}'::jsonb)
  from memberships m left join native n on n.user_id=m.user_id
  where m.trip_id=p_trip_id and bonado.is_trip_member(p_trip_id) group by m.user_id
$$;
revoke all on function bonado.get_trip_balances_v2(uuid) from public, anon;
grant execute on function bonado.get_trip_balances_v2(uuid) to authenticated;
create or replace function bonado.get_trip_balances(p_trip_id uuid)
returns table(user_id uuid,balance numeric,has_estimated_rates boolean,has_activity boolean)
language sql stable security definer set search_path=bonado as $$
  select user_id,balance,has_estimated_rates,has_activity from bonado.get_trip_balances_v2(p_trip_id)
$$;

-- Private: called inside the same trip-locked transaction as record/edit.
-- Rates map original currency -> trip default, captured once for this payment.
create function bonado.allocate_settlement(p_trip_id uuid,p_from uuid,p_to uuid,p_amount numeric,p_currency text,p_rates jsonb,p_exclude uuid default null)
returns jsonb language plpgsql security definer set search_path=bonado as $$
declare
  debt record; result jsonb := '[]'; remaining numeric := round(p_amount,2);
  payment_rate numeric; rate numeric; cleared numeric; cost numeric;
begin
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' or remaining is null or remaining <= 0 or remaining::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Invalid settlement amount or currency';
  end if;
  payment_rate := (p_rates->>p_currency)::numeric;
  if payment_rate is null or payment_rate <= 0 or payment_rate::text in ('NaN','Infinity','-Infinity') then
    raise exception 'A valid payment exchange rate is required';
  end if;
  for debt in
    select a.currency,least(-a.balance,b.balance) amount
    from bonado.trip_currency_balances_internal(p_trip_id,p_exclude) a
    join bonado.trip_currency_balances_internal(p_trip_id,p_exclude) b using(currency)
    where a.user_id=p_from and b.user_id=p_to and a.balance<0 and b.balance>0
    order by (a.currency=p_currency) desc,a.currency
  loop
    exit when remaining <= 0;
    rate := case when debt.currency=p_currency then 1 else (p_rates->>debt.currency)::numeric / payment_rate end;
    if rate is null or rate<=0 or rate::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Missing exchange rate for %',debt.currency;
    end if;
    cost := debt.amount*rate;
    if round(cost,2) <= round(remaining,2) then
      cleared := debt.amount;
    else
      cleared := trunc(remaining/rate,2);
    end if;
    if cleared>0 then
      result := result || jsonb_build_array(jsonb_build_object('currency',debt.currency,'amount',cleared,'rate_to_payment',rate));
      remaining := remaining-cleared*rate;
    end if;
  end loop;
  if round(remaining,2)>0 then
    result := result || jsonb_build_array(jsonb_build_object('currency',p_currency,'amount',round(remaining,2),'rate_to_payment',1));
  end if;
  return result;
end $$;
revoke all on function bonado.allocate_settlement(uuid,uuid,uuid,numeric,text,jsonb,uuid) from public,anon,authenticated;

-- Existing records only contain trip-currency payments; the originally tendered
-- currency cannot be recovered. Preserve those payments and allocate them using
-- the known expense valuation, in chronological order. No live FX is used here.
do $$
declare payment record; quote jsonb;
begin
  update bonado.settlements set allocations='[]'::jsonb;
  for payment in select * from bonado.settlements order by date,created_at,id loop
    -- Reconstruct the remaining book valuation (including allocations already
    -- replayed), rather than picking one day's rate for all historical expenses.
    with book_lines as (
      select p.user_id,e.currency,p.amount_paid amount,p.amount_paid*e.exchange_rate_to_trip_default book
      from bonado.payments p join bonado.entries e on e.id=p.entry_id
      where e.trip_id=payment.trip_id and e.status='active'
      union all
      select s.user_id,e.currency,-s.owed_amount,-s.owed_amount*e.exchange_rate_to_trip_default
      from bonado.line_item_shares s join bonado.line_items i on i.id=s.line_item_id
      join bonado.entries e on e.id=i.entry_id where e.trip_id=payment.trip_id and e.status='active'
      union all
      select s.user_id,e.currency,-s.owed_amount,-s.owed_amount*e.exchange_rate_to_trip_default
      from bonado.adjustment_shares s join bonado.adjustments a on a.id=s.adjustment_id
      join bonado.entries e on e.id=a.entry_id where e.trip_id=payment.trip_id and e.status='active'
      union all
      select person.user_id,a->>'currency',(a->>'amount')::numeric*person.sign,
        (a->>'amount')::numeric*(a->>'rate_to_payment')::numeric*person.sign
      from bonado.settlements s cross join lateral jsonb_array_elements(s.allocations) a
      cross join lateral (values(s.from_user_id,1),(s.to_user_id,-1)) person(user_id,sign)
      where s.trip_id=payment.trip_id
    ), valued as (
      select currency,case when sum(amount)<>0 and sum(book)/sum(amount)>0
        then sum(book)/sum(amount) else 1 end rate
      from book_lines where user_id=payment.from_user_id group by currency
    )
    select coalesce(jsonb_object_agg(currency,rate),'{}'::jsonb) into quote from valued;
    quote := quote || jsonb_build_object(payment.currency,1);
    update bonado.settlements set allocations=bonado.allocate_settlement(
      payment.trip_id,payment.from_user_id,payment.to_user_id,payment.amount,payment.currency,quote,payment.id
    ) where id=payment.id;
  end loop;
end $$;

create or replace function bonado.record_settlement_in_currency(
  p_trip_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_date date,
  p_payment_method text,
  p_payment_label text,
  p_currency text,
  p_rates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_settlement_id uuid;
  v_account_id uuid;
  v_method text;
  v_currency text;
  v_allocations jsonb;
  v_trip_currency text;
begin
  if not bonado.is_trip_member(p_trip_id) then
    raise exception 'You are not a member of this trip';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be greater than zero';
  end if;
  if p_from_user_id = p_to_user_id then
    raise exception 'Settlement members must be different';
  end if;
  if exists (
    select 1
    from unnest(array[p_from_user_id, p_to_user_id]) person_id
    where not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = person_id
    )
  ) then
    raise exception 'Settlement members must belong to this trip';
  end if;

  -- Serialize settlements for a trip so concurrent payments cannot clear the same debt.
  select default_currency into v_trip_currency from bonado.trips where id=p_trip_id for update;
  v_currency := p_currency;
  p_rates := coalesce(p_rates,'{}'::jsonb) || jsonb_build_object(v_trip_currency,1);
  v_allocations := bonado.allocate_settlement(p_trip_id,p_from_user_id,p_to_user_id,p_amount,p_currency,p_rates,null);

  v_method := nullif(trim(p_payment_method), '');

  if v_method is not null then
    select id into v_account_id
    from bonado.payment_accounts
    where user_id = p_from_user_id
      and method = v_method
      and lower(label) = lower(coalesce(nullif(trim(p_payment_label), ''), v_method))
      and currency = v_currency
    order by id
    limit 1;

    if v_account_id is null then
      insert into bonado.payment_accounts (
        user_id, type, method, label, currency, is_shared
      )
      values (
        p_from_user_id,
        case
          when lower(v_method) = 'cash' then 'cash'
          when lower(v_method) = 'bank' then 'bank'
          else 'other'
        end,
        v_method,
        coalesce(nullif(trim(p_payment_label), ''), v_method),
        v_currency,
        false
      )
      returning id into v_account_id;
    end if;
  end if;

  insert into bonado.settlements (
    trip_id, from_user_id, to_user_id, amount, date, created_by, payment_account_id, currency, exchange_rate_to_trip_default, allocations
  )
  values (
    p_trip_id, p_from_user_id, p_to_user_id, round(p_amount, 2),
    p_date, bonado.current_user_id(), v_account_id, p_currency, (p_rates->>p_currency)::numeric, v_allocations
  )
  returning id into v_settlement_id;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
  perform bonado.notify_transaction_change('settlement_created', null, v_settlement_id);
  return v_settlement_id;
end;
$$;
revoke all on function bonado.record_settlement_in_currency(uuid,uuid,uuid,numeric,date,text,text,text,jsonb) from public,anon;
grant execute on function bonado.record_settlement_in_currency(uuid,uuid,uuid,numeric,date,text,text,text,jsonb) to authenticated;

create or replace function bonado.update_settlement_in_currency(
  p_settlement_id uuid,
  p_trip_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_date date,
  p_payment_method text,
  p_payment_label text,
  p_currency text,
  p_rates jsonb
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_account_id uuid;
  v_method text;
  v_currency text;
  v_allocations jsonb;
  v_trip_currency text;
  payment_snapshot numeric;
begin
  if not bonado.is_trip_member(p_trip_id)
    or not exists (
      select 1 from bonado.settlements
      where id = p_settlement_id and trip_id = p_trip_id
    ) then
    raise exception 'You cannot edit this settlement';
  end if;
  if p_amount is null or p_amount <= 0 or p_from_user_id = p_to_user_id then
    raise exception 'Invalid settlement';
  end if;
  if exists (
    select 1
    from unnest(array[p_from_user_id, p_to_user_id]) person_id
    where not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = person_id
    )
  ) then
    raise exception 'Settlement members must belong to this trip';
  end if;

  -- Serialize settlements for a trip so concurrent payments cannot clear the same debt.
  select default_currency into v_trip_currency from bonado.trips where id=p_trip_id for update;
  v_currency := p_currency;
  p_rates := coalesce(p_rates,'{}'::jsonb) || jsonb_build_object(v_trip_currency,1);
  if exists(select 1 from settlements where id=p_settlement_id and trip_id=p_trip_id
      and from_user_id=p_from_user_id and to_user_id=p_to_user_id
      and amount=round(p_amount,2) and currency=p_currency) then
    select allocations,exchange_rate_to_trip_default into v_allocations,payment_snapshot
    from settlements where id=p_settlement_id;
    p_rates := p_rates || jsonb_build_object(p_currency,payment_snapshot);
  else
    v_allocations := bonado.allocate_settlement(p_trip_id,p_from_user_id,p_to_user_id,p_amount,p_currency,p_rates,p_settlement_id);
  end if;

  v_method := nullif(trim(p_payment_method), '');

  if v_method is not null then
    select id into v_account_id
    from bonado.payment_accounts
    where user_id = p_from_user_id
      and method = v_method
      and lower(label) = lower(coalesce(nullif(trim(p_payment_label), ''), v_method))
      and currency = v_currency
    limit 1;

    if v_account_id is null then
      insert into bonado.payment_accounts (
        user_id, type, method, label, currency, is_shared
      ) values (
        p_from_user_id,
        case when lower(v_method) = 'cash' then 'cash'
             when lower(v_method) = 'bank' then 'bank'
             else 'other' end,
        v_method,
        coalesce(nullif(trim(p_payment_label), ''), v_method),
        v_currency,
        false
      )
      returning id into v_account_id;
    end if;
  end if;

  update bonado.settlements
  set from_user_id = p_from_user_id,
      to_user_id = p_to_user_id,
      amount = round(p_amount, 2),
      currency = p_currency,
      exchange_rate_to_trip_default = (p_rates->>p_currency)::numeric,
      allocations = v_allocations,
      date = p_date,
      payment_account_id = v_account_id,
      updated_at = now()
  where id = p_settlement_id and trip_id = p_trip_id;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
  perform bonado.notify_transaction_change('settlement_edited', null, p_settlement_id);
end;
$$;
revoke all on function bonado.update_settlement_in_currency(uuid,uuid,uuid,uuid,numeric,date,text,text,text,jsonb) from public,anon;
grant execute on function bonado.update_settlement_in_currency(uuid,uuid,uuid,uuid,numeric,date,text,text,text,jsonb) to authenticated;

create or replace function bonado.record_settlement(
  p_trip_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_date date,
  p_payment_method text,
  p_payment_label text
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare c text; r jsonb;
begin
  select default_currency into c from bonado.trips where id=p_trip_id;
  select coalesce(jsonb_object_agg(currency,bonado.balance_currency_rate(p_trip_id,currency)),'{}') into r
  from (select distinct currency from bonado.get_trip_currency_balances(p_trip_id)) codes;
  return bonado.record_settlement_in_currency(p_trip_id,p_from_user_id,p_to_user_id,p_amount,p_date,p_payment_method,p_payment_label,c,r || jsonb_build_object(c,1));
end $$;
create or replace function bonado.update_settlement(
  p_settlement_id uuid,
  p_trip_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_date date,
  p_payment_method text,
  p_payment_label text
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare c text; r jsonb;
begin
  select default_currency into c from bonado.trips where id=p_trip_id;
  if exists(select 1 from bonado.settlements where id=p_settlement_id
    and trip_id=p_trip_id and currency<>c) then
    raise exception 'Update the app to edit a settlement in another currency';
  end if;
  select coalesce(jsonb_object_agg(currency,bonado.balance_currency_rate(p_trip_id,currency)),'{}') into r
  from (select distinct currency from bonado.get_trip_currency_balances(p_trip_id)) codes;
  perform bonado.update_settlement_in_currency(p_settlement_id,p_trip_id,p_from_user_id,p_to_user_id,p_amount,p_date,p_payment_method,p_payment_label,c,r || jsonb_build_object(c,1));
end $$;

-- Let any active trip member update trip-level settings while member
-- management remains protected by the existing owner-only RPCs/policies.
-- Direct trips table updates are still owner-only via 0024; this RPC keeps
-- currency rebasing centralized and safe.

create or replace function bonado.update_trip_settings(
  p_trip_id uuid,
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text,
  p_rates jsonb,
  p_location_place_id text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_old_currency text;
begin
  if not bonado.is_trip_member(p_trip_id) then
    raise exception 'Only trip members can update trip settings';
  end if;
  if nullif(trim(p_name), '') is null or p_default_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid trip settings';
  end if;

  select default_currency into v_old_currency from bonado.trips where id = p_trip_id for update;
  if v_old_currency <> p_default_currency then
    if exists (
      select 1 from bonado.entries
      where trip_id = p_trip_id
        and status = 'active'
        and not (p_rates ? currency)
    ) then
      raise exception 'A conversion rate is required for every entry currency';
    end if;

    update bonado.entries
    set exchange_rate_to_trip_default = (p_rates ->> currency)::numeric,
        rate_is_estimated = true
    where trip_id = p_trip_id and status = 'active';

    update bonado.settlements
    set exchange_rate_to_trip_default = exchange_rate_to_trip_default * (p_rates ->> v_old_currency)::numeric,
        updated_at = now()
    where trip_id = p_trip_id;
  end if;

  update bonado.trips
  set name = trim(p_name),
      location_name = nullif(trim(p_location_name), ''),
      location_place_id = nullif(trim(p_location_place_id), ''),
      location_lat = p_location_lat,
      location_lng = p_location_lng,
      default_currency = p_default_currency,
      cover_photo_url = nullif(trim(p_cover_photo_url), ''),
      last_activity_at = now()
  where id = p_trip_id;
end;
$$;

revoke all on function bonado.update_trip_settings(
  uuid, text, text, text, text, jsonb, text, double precision, double precision
) from public;
grant execute on function bonado.update_trip_settings(
  uuid, text, text, text, text, jsonb, text, double precision, double precision
) to authenticated;

create or replace function bonado.export_trip_transactions(
  p_trip_id uuid,
  p_scope text default 'personal',
  p_preferred_currency text default null
)
returns table (
  id text,
  trip_id uuid,
  trip_name text,
  transaction_type text,
  transaction_movement text,
  "timestamp" timestamptz,
  description text,
  category text,
  payee text,
  member_id uuid,
  member_name text,
  paid_amount numeric,
  paid_amount_currency text,
  share_amount numeric,
  share_amount_currency text,
  equivalent_paid_amount numeric,
  equivalent_paid_amount_currency text,
  equivalent_share_amount numeric,
  equivalent_share_amount_currency text,
  source text,
  related_payment text,
  parent_transaction_id uuid,
  created_at timestamptz,
  created_by text,
  updated_at timestamptz,
  updated_by text
)
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_current_user uuid := bonado.current_user_id();
  v_trip record;
  v_scope text := lower(coalesce(nullif(trim(p_scope), ''), 'personal'));
  v_preferred_currency text;
  v_preferred_rate numeric;
begin
  if v_current_user is null then
    raise exception 'You must be signed in to export transactions';
  end if;

  if v_scope not in ('personal', 'full') then
    raise exception 'Export scope must be personal or full';
  end if;

  select t.id, t.name, t.default_currency
  into v_trip
  from bonado.trips t
  where t.id = p_trip_id;

  if v_trip.id is null or not bonado.is_trip_member(p_trip_id) then
    raise exception 'You cannot export this trip';
  end if;

  select coalesce(
    nullif(upper(trim(p_preferred_currency)), ''),
    (select upper(u.preferred_currency) from bonado.users u where u.id = v_current_user),
    upper(v_trip.default_currency)
  )
  into v_preferred_currency;

  if v_preferred_currency = upper(v_trip.default_currency) then
    v_preferred_rate := 1;
  else
    select er.rate
    into v_preferred_rate
    from bonado.exchange_rate_cache er
    where upper(er.base_currency) = upper(v_trip.default_currency)
      and upper(er.target_currency) = v_preferred_currency
    order by er.fetched_at desc
    limit 1;
  end if;

  return query
  with payment_sources as (
    select
      p.entry_id,
      string_agg(p.id::text, ', ' order by p.id::text) as payment_ids,
      string_agg(
        distinct case
          when pa.id is null then null
          when nullif(trim(pa.label), '') is null or lower(pa.label) = lower(pa.method)
            then pa.method
          else pa.method || ' · ' || pa.label
        end,
        ', '
      ) filter (where pa.id is not null) as source_labels
    from bonado.payments p
    left join bonado.payment_accounts pa on pa.id = p.payment_account_id
    group by p.entry_id
  ),
  entry_shares as (
    select entry_id, user_id, round(sum(amount), 2) as amount
    from (
      select li.entry_id, lis.user_id, lis.owed_amount as amount
      from bonado.line_items li
      join bonado.line_item_shares lis on lis.line_item_id = li.id
      union all
      select a.entry_id, ash.user_id, ash.owed_amount as amount
      from bonado.adjustments a
      join bonado.adjustment_shares ash on ash.adjustment_id = a.id
    ) shares
    group by entry_id, user_id
  ),
  expense_rows as (
    select
      (e.id::text || ':expense:' || es.user_id::text) as id,
      e.trip_id,
      v_trip.name::text as trip_name,
      'expense'::text as transaction_type,
      'debit'::text as transaction_movement,
      e.created_at as "timestamp",
      e.description,
      c.name as category,
      e.payee,
      es.user_id as member_id,
      coalesce(u.name, 'Member') as member_name,
      null::numeric as paid_amount,
      e.currency as paid_amount_currency,
      es.amount as share_amount,
      e.currency as share_amount_currency,
      null::numeric as equivalent_paid_amount,
      v_preferred_currency as equivalent_paid_amount_currency,
      case
        when v_preferred_rate is null then null
        else round(es.amount * e.exchange_rate_to_trip_default * v_preferred_rate, 2)
      end as equivalent_share_amount,
      v_preferred_currency as equivalent_share_amount_currency,
      ps.source_labels as source,
      ps.payment_ids as related_payment,
      e.id as parent_transaction_id,
      coalesce(e.server_created_at, e.created_at) as created_at,
      coalesce(creator.name, 'Member') as created_by,
      e.last_edited_at as updated_at,
      editor.name as updated_by
    from entry_shares es
    join bonado.entries e on e.id = es.entry_id
    left join bonado.categories c on c.id = e.category_id
    left join bonado.users u on u.id = es.user_id
    left join bonado.users creator on creator.id = e.created_by
    left join bonado.users editor on editor.id = e.last_edited_by
    left join payment_sources ps on ps.entry_id = e.id
    where e.trip_id = p_trip_id
      and e.status = 'active'
      and (v_scope = 'full' or es.user_id = v_current_user)
  ),
  payment_rows as (
    select
      p.id::text as id,
      e.trip_id,
      v_trip.name::text as trip_name,
      'payment'::text as transaction_type,
      'debit'::text as transaction_movement,
      e.created_at as "timestamp",
      e.description,
      c.name as category,
      e.payee,
      p.user_id as member_id,
      coalesce(u.name, 'Member') as member_name,
      p.amount_paid as paid_amount,
      e.currency as paid_amount_currency,
      null::numeric as share_amount,
      e.currency as share_amount_currency,
      case
        when v_preferred_rate is null then null
        else round(p.amount_paid * e.exchange_rate_to_trip_default * v_preferred_rate, 2)
      end as equivalent_paid_amount,
      v_preferred_currency as equivalent_paid_amount_currency,
      null::numeric as equivalent_share_amount,
      v_preferred_currency as equivalent_share_amount_currency,
      case
        when pa.id is null then null
        when nullif(trim(pa.label), '') is null or lower(pa.label) = lower(pa.method)
          then pa.method
        else pa.method || ' · ' || pa.label
      end as source,
      null::text as related_payment,
      e.id as parent_transaction_id,
      coalesce(e.server_created_at, e.created_at) as created_at,
      coalesce(creator.name, 'Member') as created_by,
      e.last_edited_at as updated_at,
      editor.name as updated_by
    from bonado.payments p
    join bonado.entries e on e.id = p.entry_id
    left join bonado.categories c on c.id = e.category_id
    left join bonado.users u on u.id = p.user_id
    left join bonado.users creator on creator.id = e.created_by
    left join bonado.users editor on editor.id = e.last_edited_by
    left join bonado.payment_accounts pa on pa.id = p.payment_account_id
    where e.trip_id = p_trip_id
      and e.status = 'active'
      and p.amount_paid <> 0
      and (v_scope = 'full' or p.user_id = v_current_user)
  ),
  settlement_rows as (
    select
      (s.id::text || ':from') as id,
      s.trip_id,
      v_trip.name::text as trip_name,
      'settlement'::text as transaction_type,
      'debit'::text as transaction_movement,
      s.created_at as "timestamp",
      'Settlement to ' || coalesce(to_user.name, 'Member') as description,
      'Settlement'::text as category,
      coalesce(to_user.name, 'Member') as payee,
      s.from_user_id as member_id,
      coalesce(from_user.name, 'Member') as member_name,
      s.amount as paid_amount,
      s.currency::text as paid_amount_currency,
      null::numeric as share_amount,
      s.currency::text as share_amount_currency,
      case
        when v_preferred_currency = s.currency then s.amount
        when v_preferred_rate is null then null
        else round(s.amount * s.exchange_rate_to_trip_default * v_preferred_rate, 2)
      end as equivalent_paid_amount,
      v_preferred_currency as equivalent_paid_amount_currency,
      null::numeric as equivalent_share_amount,
      v_preferred_currency as equivalent_share_amount_currency,
      case
        when pa.id is null then null
        when nullif(trim(pa.label), '') is null or lower(pa.label) = lower(pa.method)
          then pa.method
        else pa.method || ' · ' || pa.label
      end as source,
      null::text as related_payment,
      s.id as parent_transaction_id,
      s.created_at as created_at,
      coalesce(creator.name, 'Member') as created_by,
      s.updated_at as updated_at,
      null::text as updated_by
    from bonado.settlements s
    left join bonado.users from_user on from_user.id = s.from_user_id
    left join bonado.users to_user on to_user.id = s.to_user_id
    left join bonado.users creator on creator.id = s.created_by
    left join bonado.payment_accounts pa on pa.id = s.payment_account_id
    where s.trip_id = p_trip_id
      and (v_scope = 'full' or s.from_user_id = v_current_user)

    union all

    select
      (s.id::text || ':to') as id,
      s.trip_id,
      v_trip.name::text as trip_name,
      'settlement'::text as transaction_type,
      'credit'::text as transaction_movement,
      s.created_at as "timestamp",
      'Settlement from ' || coalesce(from_user.name, 'Member') as description,
      'Settlement'::text as category,
      coalesce(from_user.name, 'Member') as payee,
      s.to_user_id as member_id,
      coalesce(to_user.name, 'Member') as member_name,
      s.amount as paid_amount,
      s.currency::text as paid_amount_currency,
      null::numeric as share_amount,
      s.currency::text as share_amount_currency,
      case
        when v_preferred_currency = s.currency then s.amount
        when v_preferred_rate is null then null
        else round(s.amount * s.exchange_rate_to_trip_default * v_preferred_rate, 2)
      end as equivalent_paid_amount,
      v_preferred_currency as equivalent_paid_amount_currency,
      null::numeric as equivalent_share_amount,
      v_preferred_currency as equivalent_share_amount_currency,
      case
        when pa.id is null then null
        when nullif(trim(pa.label), '') is null or lower(pa.label) = lower(pa.method)
          then pa.method
        else pa.method || ' · ' || pa.label
      end as source,
      null::text as related_payment,
      s.id as parent_transaction_id,
      s.created_at as created_at,
      coalesce(creator.name, 'Member') as created_by,
      s.updated_at as updated_at,
      null::text as updated_by
    from bonado.settlements s
    left join bonado.users from_user on from_user.id = s.from_user_id
    left join bonado.users to_user on to_user.id = s.to_user_id
    left join bonado.users creator on creator.id = s.created_by
    left join bonado.payment_accounts pa on pa.id = s.payment_account_id
    where s.trip_id = p_trip_id
      and (v_scope = 'full' or s.to_user_id = v_current_user)
  )
  select * from payment_rows
  union all
  select * from expense_rows
  union all
  select * from settlement_rows
  order by "timestamp" desc, transaction_type, id;
end;
$$;

revoke all on function bonado.export_trip_transactions(uuid, text, text) from public;
grant execute on function bonado.export_trip_transactions(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

revoke all on function bonado.get_trip_balances(uuid) from public,anon;
grant execute on function bonado.get_trip_balances(uuid) to authenticated;
revoke all on function bonado.record_settlement(uuid,uuid,uuid,numeric,date,text,text) from public,anon;
grant execute on function bonado.record_settlement(uuid,uuid,uuid,numeric,date,text,text) to authenticated;
revoke all on function bonado.update_settlement(uuid,uuid,uuid,uuid,numeric,date,text,text) from public,anon;
grant execute on function bonado.update_settlement(uuid,uuid,uuid,uuid,numeric,date,text,text) to authenticated;
