-- Phase 14.3: remove a registered member (or leave a trip) without losing
-- their trip-scoped ledger history. Financial references move to a new,
-- unclaimed placeholder carrying the same display name.

create or replace function bonado.remove_trip_member(
  p_trip_id uuid,
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_actor_id uuid := bonado.current_user_id();
  v_member_name text;
  v_member_role text;
  v_placeholder_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select u.name, m.role
  into v_member_name, v_member_role
  from bonado.memberships m
  join bonado.users u on u.id = m.user_id
  where m.trip_id = p_trip_id
    and m.user_id = p_member_id
    and u.is_registered
  for update of m;

  if v_member_name is null then
    raise exception 'Registered trip member not found';
  end if;

  if v_member_role = 'owner' then
    raise exception 'Transfer ownership before the owner can leave';
  end if;

  if v_actor_id <> p_member_id and not exists (
    select 1
    from bonado.memberships
    where trip_id = p_trip_id
      and user_id = v_actor_id
      and role = 'owner'
  ) then
    raise exception 'Only the trip owner can remove another member';
  end if;

  insert into bonado.users (name, is_registered, auth_id)
  values (v_member_name, false, null)
  returning id into v_placeholder_id;

  update bonado.payments p
  set user_id = v_placeholder_id
  from bonado.entries e
  where p.entry_id = e.id
    and e.trip_id = p_trip_id
    and p.user_id = p_member_id;

  update bonado.line_item_shares s
  set user_id = v_placeholder_id
  from bonado.line_items li, bonado.entries e
  where s.line_item_id = li.id
    and li.entry_id = e.id
    and e.trip_id = p_trip_id
    and s.user_id = p_member_id;

  update bonado.adjustment_shares s
  set user_id = v_placeholder_id
  from bonado.adjustments a, bonado.entries e
  where s.adjustment_id = a.id
    and a.entry_id = e.id
    and e.trip_id = p_trip_id
    and s.user_id = p_member_id;

  update bonado.settlements
  set from_user_id = v_placeholder_id
  where trip_id = p_trip_id and from_user_id = p_member_id;

  update bonado.settlements
  set to_user_id = v_placeholder_id
  where trip_id = p_trip_id and to_user_id = p_member_id;

  update bonado.settlements
  set created_by = v_placeholder_id
  where trip_id = p_trip_id and created_by = p_member_id;

  update bonado.entries
  set created_by = v_placeholder_id
  where trip_id = p_trip_id and created_by = p_member_id;

  update bonado.entries
  set last_edited_by = v_placeholder_id
  where trip_id = p_trip_id and last_edited_by = p_member_id;

  update bonado.entry_attachments attachment
  set uploaded_by = v_placeholder_id
  from bonado.entries entry
  where attachment.entry_id = entry.id
    and entry.trip_id = p_trip_id
    and attachment.uploaded_by = p_member_id;

  delete from bonado.memberships
  where trip_id = p_trip_id and user_id = p_member_id;

  insert into bonado.memberships (trip_id, user_id, role)
  values (p_trip_id, v_placeholder_id, 'member');

  update bonado.trips
  set last_activity_at = now()
  where id = p_trip_id;

  return v_placeholder_id;
end;
$$;

revoke all on function bonado.remove_trip_member(uuid, uuid) from public, anon;
grant execute on function bonado.remove_trip_member(uuid, uuid) to authenticated;

