-- Make expense edit history distinguish payer/payment-method edits, and avoid
-- timestamp log noise caused by hidden seconds being rounded by the edit form.

create or replace function bonado.entry_audit_payer_amounts(p_payers jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', item->'user_id',
        'name', item->'name',
        'amount', item->'amount'
      )
      order by
        item->>'name',
        item->>'user_id',
        item->>'amount'
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_payers, '[]'::jsonb)) item;
$$;

create or replace function bonado.entry_audit_payment_methods(p_payers jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', item->'user_id',
        'name', item->'name',
        'method', item->'method',
        'label', item->'label'
      )
      order by
        item->>'name',
        item->>'user_id'
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_payers, '[]'::jsonb)) item;
$$;

create or replace function bonado.entry_snapshot_diff(
  p_old jsonb,
  p_new jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_changes jsonb := '[]'::jsonb;
  v_old_payer_amounts jsonb;
  v_new_payer_amounts jsonb;
  v_old_payment_methods jsonb;
  v_new_payment_methods jsonb;
begin
  if p_old->'description' is distinct from p_new->'description' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'description',
      'from', p_old->'description',
      'to', p_new->'description'
    ));
  end if;

  if p_old->'payee' is distinct from p_new->'payee' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'payee',
      'from', p_old->'payee',
      'to', p_new->'payee'
    ));
  end if;

  if p_old->'currency' is distinct from p_new->'currency' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'currency',
      'from', p_old->'currency',
      'to', p_new->'currency'
    ));
  end if;

  if p_old->'category_id' is distinct from p_new->'category_id' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'category',
      'from', p_old->'category_name',
      'to', p_new->'category_name'
    ));
  end if;

  if p_old->'amount' is distinct from p_new->'amount' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'amount',
      'from', p_old->'amount',
      'to', p_new->'amount',
      'currency', p_new->'currency'
    ));
  end if;

  v_old_payer_amounts := bonado.entry_audit_payer_amounts(p_old->'payers');
  v_new_payer_amounts := bonado.entry_audit_payer_amounts(p_new->'payers');
  v_old_payment_methods := bonado.entry_audit_payment_methods(p_old->'payers');
  v_new_payment_methods := bonado.entry_audit_payment_methods(p_new->'payers');

  if v_old_payer_amounts is distinct from v_new_payer_amounts then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'payers',
      'from', v_old_payer_amounts,
      'to', v_new_payer_amounts,
      'currency', p_new->'currency'
    ));
  end if;

  if v_old_payment_methods is distinct from v_new_payment_methods then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'payment_methods',
      'from', v_old_payment_methods,
      'to', v_new_payment_methods
    ));
  end if;

  if p_old->'distribution' is distinct from p_new->'distribution' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'distribution',
      'from', p_old->'distribution',
      'to', p_new->'distribution',
      'currency', p_new->'currency'
    ));
  end if;

  if p_old->'line_items' is distinct from p_new->'line_items' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'line_items',
      'from', p_old->'line_items',
      'to', p_new->'line_items',
      'currency', p_new->'currency'
    ));
  end if;

  if p_old->'adjustments' is distinct from p_new->'adjustments' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'adjustments',
      'from', p_old->'adjustments',
      'to', p_new->'adjustments',
      'currency', p_new->'currency'
    ));
  end if;

  return v_changes;
end;
$$;

create or replace function bonado.update_entry_display_timestamp(
  p_entry_id uuid,
  p_date date,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_trip_id uuid;
  v_old_date date;
  v_old_created_at timestamptz;
  v_changes jsonb := '[]'::jsonb;
begin
  if p_entry_id is null or p_date is null or p_created_at is null then
    raise exception 'Entry id, date, and timestamp are required';
  end if;

  select trip_id, date, created_at
  into v_trip_id, v_old_date, v_old_created_at
  from bonado.entries
  where id = p_entry_id
    and status = 'active';

  if v_trip_id is null then
    raise exception 'Entry not found';
  end if;

  if not bonado.is_trip_member(v_trip_id) then
    raise exception 'Only trip members can update entry order';
  end if;

  if v_old_date is not distinct from p_date
    and date_trunc('minute', v_old_created_at) is not distinct from date_trunc('minute', p_created_at)
  then
    return;
  end if;

  update bonado.entries
  set
    date = p_date,
    created_at = p_created_at,
    last_edited_by = bonado.current_user_id(),
    last_edited_at = now()
  where id = p_entry_id;

  v_changes := jsonb_build_array(jsonb_build_object(
    'field', 'timestamp',
    'from', jsonb_build_object('date', v_old_date, 'created_at', v_old_created_at),
    'to', jsonb_build_object('date', p_date, 'created_at', p_created_at)
  ));
  perform bonado.append_entry_edit_log(p_entry_id, v_changes);
end;
$$;

revoke all on function bonado.update_entry_display_timestamp(uuid, date, timestamptz) from public;
grant execute on function bonado.update_entry_display_timestamp(uuid, date, timestamptz) to authenticated;
