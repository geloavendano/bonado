-- Invite previews identify temporary (auth-less) members, and a joining user
-- can atomically assume one of those identities and all of its trip ledger
-- references.

drop function if exists bonado.get_trip_preview(text);

create function bonado.get_trip_preview(p_token text)
returns table (
  trip_id uuid,
  name text,
  location_name text,
  cover_photo_url text,
  member_count integer,
  members jsonb
)
language sql
stable
security definer
set search_path = bonado
as $$
  select
    t.id,
    t.name,
    t.location_name,
    t.cover_photo_url,
    (select count(*) from bonado.memberships m where m.trip_id = t.id)::int,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'avatar_url', u.avatar_url,
            'is_claimable', (not u.is_registered and u.auth_id is null)
          )
          order by u.joined_at
        ),
        '[]'::jsonb
      )
      from (
        select u2.id, u2.name, u2.avatar_url, u2.is_registered, u2.auth_id, m2.joined_at
        from bonado.memberships m2
        join bonado.users u2 on u2.id = m2.user_id
        where m2.trip_id = t.id
      ) u
    )
  from bonado.trips t
  where t.invite_link_token = p_token
$$;

grant execute on function bonado.get_trip_preview(text) to anon, authenticated;

create or replace function bonado.claim_temporary_trip_member(
  p_trip_id uuid,
  p_guest_id uuid
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_user_id uuid;
begin
  v_user_id := bonado.current_user_id();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from bonado.memberships m
    join bonado.users u on u.id = m.user_id
    where m.trip_id = p_trip_id
      and m.user_id = p_guest_id
      and m.role <> 'owner'
      and not u.is_registered
      and u.auth_id is null
  ) then
    raise exception 'Temporary member is no longer available';
  end if;

  -- Transfer every trip-scoped ledger reference before removing the placeholder.
  update bonado.payments p
  set user_id = v_user_id
  from bonado.entries e
  where p.entry_id = e.id and e.trip_id = p_trip_id and p.user_id = p_guest_id;

  update bonado.line_item_shares s
  set user_id = v_user_id
  from bonado.line_items li, bonado.entries e
  where s.line_item_id = li.id
    and li.entry_id = e.id
    and e.trip_id = p_trip_id
    and s.user_id = p_guest_id;

  update bonado.adjustment_shares s
  set user_id = v_user_id
  from bonado.adjustments a, bonado.entries e
  where s.adjustment_id = a.id
    and a.entry_id = e.id
    and e.trip_id = p_trip_id
    and s.user_id = p_guest_id;

  update bonado.settlements
  set from_user_id = v_user_id
  where trip_id = p_trip_id and from_user_id = p_guest_id;

  update bonado.settlements
  set to_user_id = v_user_id
  where trip_id = p_trip_id and to_user_id = p_guest_id;

  update bonado.entries
  set created_by = v_user_id
  where trip_id = p_trip_id and created_by = p_guest_id;

  update bonado.entries
  set last_edited_by = v_user_id
  where trip_id = p_trip_id and last_edited_by = p_guest_id;

  update bonado.entry_attachments a
  set uploaded_by = v_user_id
  from bonado.entries e
  where a.entry_id = e.id
    and e.trip_id = p_trip_id
    and a.uploaded_by = p_guest_id;

  delete from bonado.memberships
  where trip_id = p_trip_id and user_id = p_guest_id;

  insert into bonado.memberships (trip_id, user_id, role)
  values (p_trip_id, v_user_id, 'member')
  on conflict (trip_id, user_id) do nothing;

  -- Temporary members are created for one trip and hold no auth identity.
  delete from bonado.users
  where id = p_guest_id and auth_id is null and not is_registered;
end;
$$;

revoke all on function bonado.claim_temporary_trip_member(uuid, uuid) from public;
grant execute on function bonado.claim_temporary_trip_member(uuid, uuid) to authenticated;
