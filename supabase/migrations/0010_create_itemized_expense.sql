-- Phase 6: atomic itemized expenses with per-item split modes and adjustment
-- allocations. The payload is validated against trip membership and the
-- entered total before any ledger rows are committed.

create or replace function bonado.create_itemized_expense(
  p_trip_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_payee text,
  p_date date,
  p_category_id uuid,
  p_payers jsonb,
  p_items jsonb,
  p_adjustments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_entry_id uuid;
  v_line_item_id uuid;
  v_adjustment_id uuid;
  v_user_id uuid;
  v_trip_currency text;
  v_payer jsonb;
  v_item jsonb;
  v_share jsonb;
  v_adjustment jsonb;
  v_payer_id uuid;
  v_payer_total numeric := 0;
  v_content_total numeric := 0;
  v_share_total numeric;
  v_amount numeric;
  v_method text;
  v_account_id uuid;
begin
  v_user_id := bonado.current_user_id();
  if v_user_id is null or not bonado.is_trip_member(p_trip_id) then
    raise exception 'You are not a member of this trip';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'A valid currency is required';
  end if;
  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required';
  end if;
  if coalesce(jsonb_array_length(p_payers), 0) = 0 then
    raise exception 'At least one payer is required';
  end if;
  if coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'At least one item is required';
  end if;

  for v_payer in select value from jsonb_array_elements(p_payers)
  loop
    v_payer_id := (v_payer->>'user_id')::uuid;
    v_amount := (v_payer->>'amount')::numeric;
    if v_amount <= 0 or not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = v_payer_id
    ) then
      raise exception 'Invalid payer allocation';
    end if;
    v_payer_total := v_payer_total + v_amount;
  end loop;

  if round(v_payer_total, 2) <> round(p_amount, 2) then
    raise exception 'Payer amounts must equal the expense total';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_amount := (v_item->>'amount')::numeric;
    if v_amount <= 0 or nullif(trim(v_item->>'description'), '') is null then
      raise exception 'Every item needs a description and amount';
    end if;
    if coalesce(jsonb_array_length(v_item->'shares'), 0) = 0 then
      raise exception 'Every item needs at least one share';
    end if;

    v_share_total := 0;
    for v_share in select value from jsonb_array_elements(v_item->'shares')
    loop
      if not exists (
        select 1 from bonado.memberships
        where trip_id = p_trip_id and user_id = (v_share->>'user_id')::uuid
      ) then
        raise exception 'Every item share must belong to a trip member';
      end if;
      v_share_total := v_share_total + (v_share->>'owed_amount')::numeric;
    end loop;
    if round(v_share_total, 2) <> round(v_amount, 2) then
      raise exception 'Item shares must equal the item amount';
    end if;
    v_content_total := v_content_total + v_amount;
  end loop;

  for v_adjustment in select value from jsonb_array_elements(coalesce(p_adjustments, '[]'::jsonb))
  loop
    v_amount := (v_adjustment->>'amount')::numeric;
    if v_amount < 0 then
      raise exception 'Adjustment amounts cannot be negative';
    end if;
    v_share_total := 0;
    for v_share in select value from jsonb_array_elements(v_adjustment->'shares')
    loop
      if not exists (
        select 1 from bonado.memberships
        where trip_id = p_trip_id and user_id = (v_share->>'user_id')::uuid
      ) then
        raise exception 'Every adjustment share must belong to a trip member';
      end if;
      v_share_total := v_share_total + (v_share->>'owed_amount')::numeric;
    end loop;
    if round(v_share_total, 2) <> round(v_amount, 2) then
      raise exception 'Adjustment shares must equal the adjustment amount';
    end if;
    v_content_total := v_content_total + v_amount;
  end loop;

  if round(v_content_total, 2) <> round(p_amount, 2) then
    raise exception 'Items and adjustments must reconcile to the expense total';
  end if;

  select default_currency into v_trip_currency
  from bonado.trips
  where id = p_trip_id;

  insert into bonado.entries (
    trip_id, description, date, currency, exchange_rate_to_trip_default,
    rate_is_estimated, category_id, payee, created_by
  )
  values (
    p_trip_id, trim(p_description), p_date, p_currency, 1,
    p_currency <> v_trip_currency, p_category_id, nullif(trim(p_payee), ''), v_user_id
  )
  returning id into v_entry_id;

  for v_payer in select value from jsonb_array_elements(p_payers)
  loop
    v_payer_id := (v_payer->>'user_id')::uuid;
    v_method := coalesce(nullif(trim(v_payer->>'payment_method'), ''), 'Cash');
    v_account_id := null;
    select id into v_account_id
    from bonado.payment_accounts
    where user_id = v_payer_id
      and lower(label) = lower(v_method)
      and currency = p_currency
    order by id
    limit 1;

    if v_account_id is null then
      insert into bonado.payment_accounts (user_id, type, label, currency, is_shared)
      values (
        v_payer_id,
        case
          when lower(v_method) = 'cash' then 'cash'
          when lower(v_method) = 'bank' then 'bank'
          else 'other'
        end,
        v_method,
        p_currency,
        false
      )
      returning id into v_account_id;
    end if;

    insert into bonado.payments (entry_id, user_id, amount_paid, payment_account_id)
    values (
      v_entry_id,
      v_payer_id,
      round((v_payer->>'amount')::numeric, 2),
      v_account_id
    );
  end loop;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into bonado.line_items (entry_id, description, amount)
    values (
      v_entry_id,
      trim(v_item->>'description'),
      round((v_item->>'amount')::numeric, 2)
    )
    returning id into v_line_item_id;

    for v_share in select value from jsonb_array_elements(v_item->'shares')
    loop
      insert into bonado.line_item_shares (
        line_item_id, user_id, share_type, share_value, owed_amount
      )
      values (
        v_line_item_id,
        (v_share->>'user_id')::uuid,
        v_share->>'share_type',
        nullif(v_share->>'share_value', '')::numeric,
        round((v_share->>'owed_amount')::numeric, 2)
      );
    end loop;
  end loop;

  for v_adjustment in select value from jsonb_array_elements(coalesce(p_adjustments, '[]'::jsonb))
  loop
    insert into bonado.adjustments (entry_id, type, mode, amount)
    values (
      v_entry_id,
      v_adjustment->>'type',
      v_adjustment->>'mode',
      round((v_adjustment->>'amount')::numeric, 2)
    )
    returning id into v_adjustment_id;

    for v_share in select value from jsonb_array_elements(v_adjustment->'shares')
    loop
      insert into bonado.adjustment_shares (adjustment_id, user_id, owed_amount)
      values (
        v_adjustment_id,
        (v_share->>'user_id')::uuid,
        round((v_share->>'owed_amount')::numeric, 2)
      );
    end loop;
  end loop;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
  return v_entry_id;
end;
$$;

revoke all on function bonado.create_itemized_expense(
  uuid, numeric, text, text, text, date, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function bonado.create_itemized_expense(
  uuid, numeric, text, text, text, date, uuid, jsonb, jsonb, jsonb
) to authenticated;
