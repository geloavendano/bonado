-- Phase 15 Tier 0: idempotent expense creation.
--
-- The create RPCs generated entry ids server-side, so a client retrying
-- after a dropped response (offline queue replay, flaky mobile network)
-- inserted a duplicate expense. entries.id was designed client-generated
-- for exactly this dedup (0001); this RPC finally accepts it. A retry that
-- finds its id already committed short-circuits and returns it unchanged.
--
-- Internally it reuses create_itemized_expense untouched and then re-keys
-- the fresh graph under the client id by moving child rows — the same
-- pattern replace_expense (0013) uses, since the entries PK carries no
-- ON UPDATE CASCADE.

create or replace function bonado.create_expense_idempotent(
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
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_tmp uuid;
begin
  if p_entry_id is null then
    raise exception 'A client entry id is required';
  end if;
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required';
  end if;

  -- retry of an already-committed create: nothing to do
  if exists (
    select 1 from bonado.entries
    where id = p_entry_id
      and trip_id = p_trip_id
      and created_by = bonado.current_user_id()
  ) then
    return p_entry_id;
  end if;
  if exists (select 1 from bonado.entries where id = p_entry_id) then
    raise exception 'Entry id conflict';
  end if;

  v_tmp := bonado.create_itemized_expense(
    p_trip_id, p_amount, p_currency, p_description, p_payee, p_date,
    p_category_id, p_payers, p_items, p_adjustments
  );

  insert into bonado.entries (
    id, trip_id, description, date, currency, exchange_rate_to_trip_default,
    rate_is_estimated, category_id, payee, status, created_by, created_at,
    server_created_at, last_edited_by, last_edited_at, sync_status
  )
  select
    p_entry_id, trip_id, description, date, currency, p_exchange_rate,
    false, category_id, payee, status, created_by, created_at,
    server_created_at, last_edited_by, last_edited_at, sync_status
  from bonado.entries
  where id = v_tmp
  on conflict (id) do nothing;

  if not found then
    -- a concurrent retry of the same client id won the race
    delete from bonado.entries where id = v_tmp;
    return p_entry_id;
  end if;

  update bonado.payments set entry_id = p_entry_id where entry_id = v_tmp;
  update bonado.line_items set entry_id = p_entry_id where entry_id = v_tmp;
  update bonado.adjustments set entry_id = p_entry_id where entry_id = v_tmp;
  delete from bonado.entries where id = v_tmp;

  perform bonado.notify_transaction_change('expense_created', p_entry_id, null);
  return p_entry_id;
end;
$$;

revoke all on function bonado.create_expense_idempotent(
  uuid, uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function bonado.create_expense_idempotent(
  uuid, uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) to authenticated;
