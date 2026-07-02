alter table bonado.settlements
add column if not exists updated_at timestamptz;

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
declare
  v_account_id uuid;
  v_method text;
  v_currency text;
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

  select default_currency into v_currency from bonado.trips where id = p_trip_id;
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
      date = p_date,
      payment_account_id = v_account_id,
      updated_at = now()
  where id = p_settlement_id and trip_id = p_trip_id;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
end;
$$;

revoke all on function bonado.update_settlement(
  uuid, uuid, uuid, uuid, numeric, date, text, text
) from public;
grant execute on function bonado.update_settlement(
  uuid, uuid, uuid, uuid, numeric, date, text, text
) to authenticated;

create or replace function bonado.update_trip_settings(
  p_trip_id uuid,
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text,
  p_rates jsonb
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_old_currency text;
begin
  if not exists (
    select 1 from bonado.memberships
    where trip_id = p_trip_id
      and user_id = bonado.current_user_id()
      and role = 'owner'
  ) then
    raise exception 'Only the trip owner can update trip settings';
  end if;
  if nullif(trim(p_name), '') is null or p_default_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid trip settings';
  end if;

  select default_currency into v_old_currency from bonado.trips where id = p_trip_id;
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
    set amount = round(amount * (p_rates ->> v_old_currency)::numeric, 2),
        updated_at = now()
    where trip_id = p_trip_id;
  end if;

  update bonado.trips
  set name = trim(p_name),
      location_name = nullif(trim(p_location_name), ''),
      default_currency = p_default_currency,
      cover_photo_url = nullif(trim(p_cover_photo_url), ''),
      last_activity_at = now()
  where id = p_trip_id;
end;
$$;

revoke all on function bonado.update_trip_settings(
  uuid, text, text, text, text, jsonb
) from public;
grant execute on function bonado.update_trip_settings(
  uuid, text, text, text, text, jsonb
) to authenticated;

create or replace function bonado.cache_exchange_rate(
  p_base_currency text,
  p_target_currency text,
  p_rate numeric
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if bonado.current_user_id() is null
    or p_base_currency !~ '^[A-Z]{3}$'
    or p_target_currency !~ '^[A-Z]{3}$'
    or p_rate <= 0 then
    raise exception 'Invalid exchange rate';
  end if;
  insert into bonado.exchange_rate_cache (
    base_currency, target_currency, rate, fetched_at
  ) values (
    p_base_currency, p_target_currency, p_rate, now()
  )
  on conflict (base_currency, target_currency)
  do update set rate = excluded.rate, fetched_at = excluded.fetched_at;
end;
$$;

revoke all on function bonado.cache_exchange_rate(text, text, numeric) from public;
grant execute on function bonado.cache_exchange_rate(text, text, numeric) to authenticated;

create or replace function bonado.create_itemized_expense_with_rate(
  p_trip_id uuid,
  p_amount numeric,
  p_currency text,
  p_exchange_rate numeric,
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
begin
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required';
  end if;
  v_entry_id := bonado.create_itemized_expense(
    p_trip_id, p_amount, p_currency, p_description, p_payee, p_date,
    p_category_id, p_payers, p_items, p_adjustments
  );
  update bonado.entries
  set exchange_rate_to_trip_default = p_exchange_rate,
      rate_is_estimated = false
  where id = v_entry_id;
  return v_entry_id;
end;
$$;

revoke all on function bonado.create_itemized_expense_with_rate(
  uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function bonado.create_itemized_expense_with_rate(
  uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) to authenticated;

create or replace function bonado.replace_expense_with_rate(
  p_entry_id uuid,
  p_trip_id uuid,
  p_amount numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_description text,
  p_payee text,
  p_date date,
  p_category_id uuid,
  p_payers jsonb,
  p_items jsonb,
  p_adjustments jsonb
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required';
  end if;
  perform bonado.replace_expense(
    p_entry_id, p_trip_id, p_amount, p_currency, p_description, p_payee,
    p_date, p_category_id, p_payers, p_items, p_adjustments
  );
  update bonado.entries
  set exchange_rate_to_trip_default = p_exchange_rate,
      rate_is_estimated = false
  where id = p_entry_id;
end;
$$;

revoke all on function bonado.replace_expense_with_rate(
  uuid, uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function bonado.replace_expense_with_rate(
  uuid, uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) to authenticated;
