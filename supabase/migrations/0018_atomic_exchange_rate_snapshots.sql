-- These definitions are repeated from the tail of 0017 because the additional
-- Phase 10 work landed after 0017 had already been applied remotely.

create or replace function bonado.cache_exchange_rate(
  p_base_currency text, p_target_currency text, p_rate numeric
)
returns void language plpgsql security definer set search_path = bonado as $$
begin
  if bonado.current_user_id() is null
    or p_base_currency !~ '^[A-Z]{3}$'
    or p_target_currency !~ '^[A-Z]{3}$'
    or p_rate <= 0 then
    raise exception 'Invalid exchange rate';
  end if;
  insert into bonado.exchange_rate_cache (
    base_currency, target_currency, rate, fetched_at
  ) values (p_base_currency, p_target_currency, p_rate, now())
  on conflict (base_currency, target_currency)
  do update set rate = excluded.rate, fetched_at = excluded.fetched_at;
end;
$$;

revoke all on function bonado.cache_exchange_rate(text, text, numeric) from public;
grant execute on function bonado.cache_exchange_rate(text, text, numeric) to authenticated;

create or replace function bonado.create_itemized_expense_with_rate(
  p_trip_id uuid, p_amount numeric, p_currency text, p_exchange_rate numeric,
  p_description text, p_payee text, p_date date, p_category_id uuid,
  p_payers jsonb, p_items jsonb, p_adjustments jsonb
)
returns uuid language plpgsql security definer set search_path = bonado as $$
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
  p_entry_id uuid, p_trip_id uuid, p_amount numeric, p_currency text,
  p_exchange_rate numeric, p_description text, p_payee text, p_date date,
  p_category_id uuid, p_payers jsonb, p_items jsonb, p_adjustments jsonb
)
returns void language plpgsql security definer set search_path = bonado as $$
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
