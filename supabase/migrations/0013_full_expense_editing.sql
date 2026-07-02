-- Preserve the selected payment method separately from its user label, then
-- support atomic replacement of an expense's complete payer/split graph.

alter table bonado.payment_accounts
add column if not exists method text;

update bonado.payment_accounts
set method = case
  when type = 'cash' then 'Cash'
  when type = 'bank' then 'Bank'
  else 'Other'
end
where method is null;

alter table bonado.payment_accounts
alter column method set not null;

alter table bonado.payment_accounts
add constraint payment_accounts_method_check
check (method in ('Cash', 'Card', 'Bank', 'Other'));

do $migration$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef(
    'bonado.create_itemized_expense(uuid,numeric,text,text,text,date,uuid,jsonb,jsonb,jsonb)'::regprocedure
  );

  v_updated := replace(
    v_definition,
    $old$        and lower(label) = lower(
          coalesce(nullif(trim(v_payer->>'payment_label'), ''), v_method)
        )
        and currency = p_currency$old$,
    $new$        and method = v_method
        and lower(label) = lower(
          coalesce(nullif(trim(v_payer->>'payment_label'), ''), v_method)
        )
        and currency = p_currency$new$
  );

  v_updated := replace(
    v_updated,
    'insert into bonado.payment_accounts (user_id, type, label, currency, is_shared)',
    'insert into bonado.payment_accounts (user_id, type, method, label, currency, is_shared)'
  );

  v_updated := replace(
    v_updated,
    $old$          end,
          coalesce(nullif(trim(v_payer->>'payment_label'), ''), v_method),$old$,
    $new$          end,
          v_method,
          coalesce(nullif(trim(v_payer->>'payment_label'), ''), v_method),$new$
  );

  if v_updated = v_definition then
    raise exception 'create_itemized_expense payment account block was not updated';
  end if;

  execute v_updated;
end;
$migration$;

create or replace function bonado.replace_expense(
  p_entry_id uuid,
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
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_new_entry_id uuid;
begin
  if bonado.entry_trip_id(p_entry_id) is distinct from p_trip_id
    or not bonado.is_trip_member(p_trip_id) then
    raise exception 'You cannot edit this expense';
  end if;

  v_new_entry_id := bonado.create_itemized_expense(
    p_trip_id,
    p_amount,
    p_currency,
    p_description,
    p_payee,
    p_date,
    p_category_id,
    p_payers,
    p_items,
    p_adjustments
  );

  delete from bonado.payments where entry_id = p_entry_id;
  delete from bonado.line_items where entry_id = p_entry_id;
  delete from bonado.adjustments where entry_id = p_entry_id;

  update bonado.payments set entry_id = p_entry_id where entry_id = v_new_entry_id;
  update bonado.line_items set entry_id = p_entry_id where entry_id = v_new_entry_id;
  update bonado.adjustments set entry_id = p_entry_id where entry_id = v_new_entry_id;

  update bonado.entries existing
  set description = replacement.description,
      date = replacement.date,
      currency = replacement.currency,
      exchange_rate_to_trip_default = replacement.exchange_rate_to_trip_default,
      rate_is_estimated = replacement.rate_is_estimated,
      category_id = replacement.category_id,
      payee = replacement.payee,
      last_edited_by = bonado.current_user_id(),
      last_edited_at = now()
  from bonado.entries replacement
  where existing.id = p_entry_id
    and replacement.id = v_new_entry_id;

  delete from bonado.entries where id = v_new_entry_id;
end;
$$;

revoke all on function bonado.replace_expense(
  uuid, uuid, numeric, text, text, text, date, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function bonado.replace_expense(
  uuid, uuid, numeric, text, text, text, date, uuid, jsonb, jsonb, jsonb
) to authenticated;
