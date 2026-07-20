-- Allow clients to set the display/order timestamp separately from the
-- business date. Used by mobile create/edit forms and transaction history
-- reordering without changing the idempotent create RPC signature.

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
begin
  if p_entry_id is null or p_date is null or p_created_at is null then
    raise exception 'Entry id, date, and timestamp are required';
  end if;

  select trip_id into v_trip_id
  from bonado.entries
  where id = p_entry_id
    and status = 'active';

  if v_trip_id is null then
    raise exception 'Entry not found';
  end if;

  if not bonado.is_trip_member(v_trip_id) then
    raise exception 'Only trip members can update entry order';
  end if;

  update bonado.entries
  set
    date = p_date,
    created_at = p_created_at,
    last_edited_by = bonado.current_user_id(),
    last_edited_at = now()
  where id = p_entry_id;
end;
$$;

revoke all on function bonado.update_entry_display_timestamp(uuid, date, timestamptz) from public;
grant execute on function bonado.update_entry_display_timestamp(uuid, date, timestamptz) to authenticated;

create or replace function bonado.update_settlement_display_timestamp(
  p_settlement_id uuid,
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
begin
  if p_settlement_id is null or p_date is null or p_created_at is null then
    raise exception 'Settlement id, date, and timestamp are required';
  end if;

  select trip_id into v_trip_id
  from bonado.settlements
  where id = p_settlement_id;

  if v_trip_id is null then
    raise exception 'Settlement not found';
  end if;

  if not bonado.is_trip_member(v_trip_id) then
    raise exception 'Only trip members can update settlement order';
  end if;

  update bonado.settlements
  set
    date = p_date,
    created_at = p_created_at
  where id = p_settlement_id;
end;
$$;

revoke all on function bonado.update_settlement_display_timestamp(uuid, date, timestamptz) from public;
grant execute on function bonado.update_settlement_display_timestamp(uuid, date, timestamptz) to authenticated;
