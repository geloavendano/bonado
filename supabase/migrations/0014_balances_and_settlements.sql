-- Phase 8: aggregate each member's net position in the trip default
-- currency and record settlements atomically.

create or replace function bonado.get_trip_balances(p_trip_id uuid)
returns table (
  user_id uuid,
  balance numeric,
  has_estimated_rates boolean,
  has_activity boolean
)
language sql
stable
security definer
set search_path = bonado
as $$
  with members as (
    select m.user_id
    from bonado.memberships m
    where m.trip_id = p_trip_id
  ),
  paid as (
    select p.user_id, sum(p.amount_paid * e.exchange_rate_to_trip_default) amount
    from bonado.payments p
    join bonado.entries e on e.id = p.entry_id
    where e.trip_id = p_trip_id and e.status = 'active'
    group by p.user_id
  ),
  item_owed as (
    select s.user_id, sum(s.owed_amount * e.exchange_rate_to_trip_default) amount
    from bonado.line_item_shares s
    join bonado.line_items item on item.id = s.line_item_id
    join bonado.entries e on e.id = item.entry_id
    where e.trip_id = p_trip_id and e.status = 'active'
    group by s.user_id
  ),
  adjustment_owed as (
    select s.user_id, sum(s.owed_amount * e.exchange_rate_to_trip_default) amount
    from bonado.adjustment_shares s
    join bonado.adjustments adjustment on adjustment.id = s.adjustment_id
    join bonado.entries e on e.id = adjustment.entry_id
    where e.trip_id = p_trip_id and e.status = 'active'
    group by s.user_id
  ),
  settlement_net as (
    select person_id user_id, sum(amount) amount
    from (
      select from_user_id person_id, amount
      from bonado.settlements where trip_id = p_trip_id
      union all
      select to_user_id person_id, -amount
      from bonado.settlements where trip_id = p_trip_id
    ) settlement_lines
    group by person_id
  ),
  estimate as (
    select exists (
      select 1 from bonado.entries
      where trip_id = p_trip_id and status = 'active' and rate_is_estimated
    ) value
  ),
  activity as (
    select (
      exists (
        select 1 from bonado.entries
        where trip_id = p_trip_id and status = 'active'
      )
      or exists (
        select 1 from bonado.settlements where trip_id = p_trip_id
      )
    ) value
  )
  select
    members.user_id,
    round(
      coalesce(paid.amount, 0)
      - coalesce(item_owed.amount, 0)
      - coalesce(adjustment_owed.amount, 0)
      + coalesce(settlement_net.amount, 0),
      2
    ),
    estimate.value,
    activity.value
  from members
  cross join estimate
  cross join activity
  left join paid using (user_id)
  left join item_owed using (user_id)
  left join adjustment_owed using (user_id)
  left join settlement_net using (user_id)
$$;

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
declare
  v_settlement_id uuid;
  v_account_id uuid;
  v_method text;
  v_currency text;
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

  select default_currency into v_currency from bonado.trips where id = p_trip_id;
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
    trip_id, from_user_id, to_user_id, amount, date, created_by, payment_account_id
  )
  values (
    p_trip_id, p_from_user_id, p_to_user_id, round(p_amount, 2),
    p_date, bonado.current_user_id(), v_account_id
  )
  returning id into v_settlement_id;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
  return v_settlement_id;
end;
$$;

revoke all on function bonado.get_trip_balances(uuid) from public;
revoke all on function bonado.record_settlement(
  uuid, uuid, uuid, numeric, date, text, text
) from public;
grant execute on function bonado.get_trip_balances(uuid) to authenticated;
grant execute on function bonado.record_settlement(
  uuid, uuid, uuid, numeric, date, text, text
) to authenticated;
