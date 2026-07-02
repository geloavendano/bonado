-- Trip owners may rename or remove unclaimed (anonymous) members.
-- These operations live behind SECURITY DEFINER functions because users may
-- normally update only their own profile, and membership writes should not
-- rely on the broader legacy RLS policy.

create or replace function bonado.rename_trip_guest(
  p_trip_id uuid,
  p_guest_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Guest name cannot be empty';
  end if;

  if not exists (
    select 1
    from bonado.memberships
    where trip_id = p_trip_id
      and user_id = bonado.current_user_id()
      and role = 'owner'
  ) then
    raise exception 'Only the trip owner can edit guests';
  end if;

  update bonado.users u
  set name = trim(p_name)
  where u.id = p_guest_id
    and not u.is_registered
    and exists (
      select 1
      from bonado.memberships m
      where m.trip_id = p_trip_id
        and m.user_id = u.id
        and m.role <> 'owner'
    );

  if not found then
    raise exception 'Unclaimed guest not found';
  end if;
end;
$$;

create or replace function bonado.remove_trip_guest(
  p_trip_id uuid,
  p_guest_id uuid
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if not exists (
    select 1
    from bonado.memberships
    where trip_id = p_trip_id
      and user_id = bonado.current_user_id()
      and role = 'owner'
  ) then
    raise exception 'Only the trip owner can remove guests';
  end if;

  delete from bonado.memberships m
  using bonado.users u
  where m.trip_id = p_trip_id
    and m.user_id = p_guest_id
    and m.role <> 'owner'
    and u.id = m.user_id
    and not u.is_registered;

  if not found then
    raise exception 'Unclaimed guest not found';
  end if;
end;
$$;

revoke all on function bonado.rename_trip_guest(uuid, uuid, text) from public;
revoke all on function bonado.remove_trip_guest(uuid, uuid) from public;
grant execute on function bonado.rename_trip_guest(uuid, uuid, text) to authenticated;
grant execute on function bonado.remove_trip_guest(uuid, uuid) to authenticated;
