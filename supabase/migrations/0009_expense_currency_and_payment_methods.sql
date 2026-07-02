-- Capture an entry's actual currency and a payment account for each payer.
-- Foreign entries are marked estimated until Phase 10 resolves a rate
-- snapshot into the trip's default currency.

drop function if exists bonado.create_simple_expense(
  uuid, numeric, text, text, date, uuid, jsonb, uuid[]
);

create function bonado.create_simple_expense(
  p_trip_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_payee text,
  p_date date,
  p_category_id uuid,
  p_payers jsonb,
  p_participant_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_entry_id uuid;
  v_line_item_id uuid;
  v_user_id uuid;
  v_trip_currency text;
  v_payer jsonb;
  v_payer_id uuid;
  v_payer_amount numeric;
  v_payer_total numeric := 0;
  v_method text;
  v_account_id uuid;
  v_participant_id uuid;
  v_participant_count integer;
  v_share numeric;
  v_allocated numeric := 0;
  v_index integer := 0;
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

  v_participant_count := coalesce(array_length(p_participant_ids, 1), 0);
  if v_participant_count = 0 then
    raise exception 'At least one participant is required';
  end if;

  if exists (
    select 1
    from unnest(p_participant_ids) participant_id
    where not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = participant_id
    )
  ) then
    raise exception 'Every participant must be a trip member';
  end if;

  for v_payer in select value from jsonb_array_elements(p_payers)
  loop
    v_payer_id := (v_payer->>'user_id')::uuid;
    v_payer_amount := (v_payer->>'amount')::numeric;
    if v_payer_amount <= 0 or not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = v_payer_id
    ) then
      raise exception 'Invalid payer allocation';
    end if;
    v_payer_total := v_payer_total + v_payer_amount;
  end loop;

  if round(v_payer_total, 2) <> round(p_amount, 2) then
    raise exception 'Payer amounts must equal the expense total';
  end if;

  select default_currency into v_trip_currency
  from bonado.trips
  where id = p_trip_id;

  insert into bonado.entries (
    trip_id,
    description,
    date,
    currency,
    exchange_rate_to_trip_default,
    rate_is_estimated,
    category_id,
    payee,
    created_by
  )
  values (
    p_trip_id,
    trim(p_description),
    p_date,
    p_currency,
    1,
    p_currency <> v_trip_currency,
    p_category_id,
    nullif(trim(p_payee), ''),
    v_user_id
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

  insert into bonado.line_items (entry_id, description, amount)
  values (v_entry_id, trim(p_description), round(p_amount, 2))
  returning id into v_line_item_id;

  v_share := trunc(round(p_amount, 2) / v_participant_count, 2);
  foreach v_participant_id in array p_participant_ids
  loop
    v_index := v_index + 1;
    insert into bonado.line_item_shares (
      line_item_id,
      user_id,
      share_type,
      share_value,
      owed_amount
    )
    values (
      v_line_item_id,
      v_participant_id,
      'equal',
      null,
      case
        when v_index = v_participant_count then round(p_amount, 2) - v_allocated
        else v_share
      end
    );
    v_allocated := v_allocated + v_share;
  end loop;

  update bonado.trips
  set last_activity_at = now()
  where id = p_trip_id;

  return v_entry_id;
end;
$$;

revoke all on function bonado.create_simple_expense(
  uuid, numeric, text, text, text, date, uuid, jsonb, uuid[]
) from public;
grant execute on function bonado.create_simple_expense(
  uuid, numeric, text, text, text, date, uuid, jsonb, uuid[]
) to authenticated;
