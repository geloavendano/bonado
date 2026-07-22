-- Keep the legacy details-only edit RPC in sync with the JSON edit history.

create or replace function bonado.update_entry_details(
  p_entry_id uuid,
  p_description text,
  p_payee text,
  p_date date,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb;
  v_old_date date;
  v_created_at timestamptz;
begin
  if not bonado.is_trip_member(bonado.entry_trip_id(p_entry_id)) then
    raise exception 'You cannot edit this expense';
  end if;
  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required';
  end if;

  v_before := bonado.entry_audit_snapshot(p_entry_id);

  select date, created_at
  into v_old_date, v_created_at
  from bonado.entries
  where id = p_entry_id and status = 'active';

  update bonado.entries
  set description = trim(p_description),
      payee = nullif(trim(p_payee), ''),
      date = p_date,
      category_id = p_category_id,
      last_edited_by = bonado.current_user_id(),
      last_edited_at = now()
  where id = p_entry_id and status = 'active';

  if found then
    v_after := bonado.entry_audit_snapshot(p_entry_id);
    v_changes := bonado.entry_snapshot_diff(v_before, v_after);
    if v_old_date is distinct from p_date then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'field', 'timestamp',
        'from', jsonb_build_object('date', v_old_date, 'created_at', v_created_at),
        'to', jsonb_build_object('date', p_date, 'created_at', v_created_at)
      ));
    end if;
    perform bonado.append_entry_edit_log(p_entry_id, v_changes);
    perform bonado.notify_transaction_change('expense_edited', p_entry_id, null);
  end if;
end;
$$;

revoke all on function bonado.update_entry_details(uuid, text, text, date, uuid) from public;
grant execute on function bonado.update_entry_details(uuid, text, text, date, uuid) to authenticated;
