-- Trip owners can add an unclaimed placeholder member before that person
-- joins Bonado. The user row intentionally has no auth_id until a future
-- account-claim flow links or merges it.

create or replace function bonado.add_temporary_trip_member(
  p_trip_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_guest_id uuid;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Member name cannot be empty';
  end if;

  if not exists (
    select 1
    from bonado.memberships
    where trip_id = p_trip_id
      and user_id = bonado.current_user_id()
      and role = 'owner'
  ) then
    raise exception 'Only the trip owner can add members';
  end if;

  insert into bonado.users (name, is_registered)
  values (trim(p_name), false)
  returning id into v_guest_id;

  insert into bonado.memberships (trip_id, user_id, role)
  values (p_trip_id, v_guest_id, 'member');

  return v_guest_id;
end;
$$;

revoke all on function bonado.add_temporary_trip_member(uuid, text) from public;
grant execute on function bonado.add_temporary_trip_member(uuid, text) to authenticated;
