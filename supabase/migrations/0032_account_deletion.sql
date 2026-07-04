-- Phase 15 Tier 2: full account deletion (App Store / Play requirement).
--
-- Deleting an account must not corrupt other members' ledgers, so each trip
-- is handled like remove_trip_member (0027): the leaver's financial
-- footprint moves to an unclaimed placeholder with the same display name.
-- Additionally: trips where the user is the only member are deleted
-- outright; owned trips transfer ownership to the earliest-joined remaining
-- member; trips.created_by and comments.author_id (not needed in 0027,
-- required here because the user row disappears) are reassigned too.
-- Finally both the bonado.users row and the auth.users row are removed.

create or replace function bonado.delete_account()
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_user uuid := bonado.current_user_id();
  v_auth uuid := auth.uid();
  v_name text;
  r record;
  v_placeholder uuid;
  v_new_owner uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  select name into v_name from bonado.users where id = v_user;

  for r in
    select m.trip_id, m.role
    from bonado.memberships m
    where m.user_id = v_user
  loop
    if not exists (
      select 1 from bonado.memberships
      where trip_id = r.trip_id and user_id <> v_user
    ) then
      delete from bonado.trips where id = r.trip_id;
      continue;
    end if;

    if r.role = 'owner' then
      select user_id into v_new_owner
      from bonado.memberships
      where trip_id = r.trip_id and user_id <> v_user
      order by joined_at
      limit 1;
      update bonado.memberships
      set role = 'owner'
      where trip_id = r.trip_id and user_id = v_new_owner;
    end if;

    insert into bonado.users (name, is_registered, auth_id)
    values (v_name, false, null)
    returning id into v_placeholder;

    update bonado.payments p
    set user_id = v_placeholder
    from bonado.entries e
    where p.entry_id = e.id and e.trip_id = r.trip_id and p.user_id = v_user;

    update bonado.line_item_shares s
    set user_id = v_placeholder
    from bonado.line_items li, bonado.entries e
    where s.line_item_id = li.id and li.entry_id = e.id
      and e.trip_id = r.trip_id and s.user_id = v_user;

    update bonado.adjustment_shares s
    set user_id = v_placeholder
    from bonado.adjustments a, bonado.entries e
    where s.adjustment_id = a.id and a.entry_id = e.id
      and e.trip_id = r.trip_id and s.user_id = v_user;

    update bonado.settlements set from_user_id = v_placeholder
    where trip_id = r.trip_id and from_user_id = v_user;
    update bonado.settlements set to_user_id = v_placeholder
    where trip_id = r.trip_id and to_user_id = v_user;
    update bonado.settlements set created_by = v_placeholder
    where trip_id = r.trip_id and created_by = v_user;

    update bonado.entries set created_by = v_placeholder
    where trip_id = r.trip_id and created_by = v_user;
    update bonado.entries set last_edited_by = v_placeholder
    where trip_id = r.trip_id and last_edited_by = v_user;

    update bonado.entry_attachments attachment
    set uploaded_by = v_placeholder
    from bonado.entries entry
    where attachment.entry_id = entry.id
      and entry.trip_id = r.trip_id
      and attachment.uploaded_by = v_user;

    update bonado.comments set author_id = v_placeholder
    where trip_id = r.trip_id and author_id = v_user;

    update bonado.trips set created_by = v_placeholder
    where id = r.trip_id and created_by = v_user;

    delete from bonado.memberships
    where trip_id = r.trip_id and user_id = v_user;

    insert into bonado.memberships (trip_id, user_id, role)
    values (r.trip_id, v_placeholder, 'member');

    update bonado.trips set last_activity_at = now() where id = r.trip_id;
  end loop;

  -- deleting the user cascades their payment_accounts, which historical
  -- payments/settlements still reference without a cascade of their own
  update bonado.payments set payment_account_id = null
  where payment_account_id in (
    select id from bonado.payment_accounts where user_id = v_user
  );
  update bonado.settlements set payment_account_id = null
  where payment_account_id in (
    select id from bonado.payment_accounts where user_id = v_user
  );

  -- users who claimed an account from a guest reference the old guest row
  update bonado.users set claimed_from_guest_id = null
  where claimed_from_guest_id = v_user;

  delete from bonado.users where id = v_user;
  delete from auth.users where id = v_auth;
end;
$$;

revoke all on function bonado.delete_account() from public, anon;
grant execute on function bonado.delete_account() to authenticated;
