-- When an owner removes a registered member, let them transfer that member's
-- complete trip-scoped ledger footprint to another current member. Passing
-- null preserves the existing behavior: create an unclaimed placeholder.

drop function if exists bonado.remove_trip_member(uuid, uuid);

create function bonado.remove_trip_member(
  p_trip_id uuid,
  p_member_id uuid,
  p_reassign_to_user_id uuid default null
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
  v_destination_id uuid;
  v_created_placeholder boolean := false;
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

  if p_reassign_to_user_id is not null then
    if v_actor_id = p_member_id then
      raise exception 'Only the trip owner can reassign another member''s records';
    end if;
    if p_reassign_to_user_id = p_member_id then
      raise exception 'Choose a different destination member';
    end if;
    if not exists (
      select 1
      from bonado.memberships
      where trip_id = p_trip_id
        and user_id = p_reassign_to_user_id
    ) then
      raise exception 'Destination member does not belong to this trip';
    end if;
    v_destination_id := p_reassign_to_user_id;
  else
    insert into bonado.users (name, is_registered, auth_id)
    values (v_member_name, false, null)
    returning id into v_destination_id;
    v_created_placeholder := true;
  end if;

  update bonado.payments p
  set
    user_id = v_destination_id,
    payment_account_id = case
      when v_created_placeholder then p.payment_account_id
      else null
    end
  from bonado.entries e
  where p.entry_id = e.id
    and e.trip_id = p_trip_id
    and p.user_id = p_member_id;

  update bonado.line_item_shares s
  set user_id = v_destination_id
  from bonado.line_items li, bonado.entries e
  where s.line_item_id = li.id
    and li.entry_id = e.id
    and e.trip_id = p_trip_id
    and s.user_id = p_member_id;

  update bonado.adjustment_shares s
  set user_id = v_destination_id
  from bonado.adjustments a, bonado.entries e
  where s.adjustment_id = a.id
    and a.entry_id = e.id
    and e.trip_id = p_trip_id
    and s.user_id = p_member_id;

  update bonado.settlements
  set
    from_user_id = v_destination_id,
    payment_account_id = case
      when v_created_placeholder then payment_account_id
      else null
    end
  where trip_id = p_trip_id and from_user_id = p_member_id;

  update bonado.settlements
  set to_user_id = v_destination_id
  where trip_id = p_trip_id and to_user_id = p_member_id;

  -- Merging two identities can collapse a settlement into a payment from a
  -- member to themselves; that line has no remaining financial effect.
  delete from bonado.settlements
  where trip_id = p_trip_id
    and from_user_id = to_user_id;

  if not v_created_placeholder then
    -- Existing destinations may already have rows on the same expense/item.
    -- Collapse those duplicates so edit forms still receive one allocation
    -- per member while preserving the combined monetary value.
    with grouped as (
      select
        p.entry_id,
        (array_agg(p.id order by (account.user_id = v_destination_id) desc, p.id))[1] keep_id,
        sum(p.amount_paid) total
      from bonado.payments p
      join bonado.entries e on e.id = p.entry_id
      left join bonado.payment_accounts account on account.id = p.payment_account_id
      where e.trip_id = p_trip_id and p.user_id = v_destination_id
      group by p.entry_id
      having count(*) > 1
    )
    update bonado.payments p
    set
      amount_paid = grouped.total,
      payment_account_id = case
        when exists (
          select 1
          from bonado.payment_accounts account
          where account.id = p.payment_account_id
            and account.user_id = v_destination_id
        ) then p.payment_account_id
        else null
      end
    from grouped
    where p.id = grouped.keep_id;

    with grouped as (
      select p.entry_id, (array_agg(p.id order by p.id))[1] keep_id
      from bonado.payments p
      join bonado.entries e on e.id = p.entry_id
      where e.trip_id = p_trip_id and p.user_id = v_destination_id
      group by p.entry_id
      having count(*) > 1
    )
    delete from bonado.payments p
    using grouped
    where p.entry_id = grouped.entry_id
      and p.user_id = v_destination_id
      and p.id <> grouped.keep_id;

    with grouped as (
      select s.line_item_id, (array_agg(s.id order by s.id))[1] keep_id, sum(s.owed_amount) total
      from bonado.line_item_shares s
      join bonado.line_items li on li.id = s.line_item_id
      join bonado.entries e on e.id = li.entry_id
      where e.trip_id = p_trip_id and s.user_id = v_destination_id
      group by s.line_item_id
      having count(*) > 1
    )
    update bonado.line_item_shares s
    set
      share_type = 'exact',
      share_value = grouped.total,
      owed_amount = grouped.total
    from grouped
    where s.id = grouped.keep_id;

    with grouped as (
      select s.line_item_id, (array_agg(s.id order by s.id))[1] keep_id
      from bonado.line_item_shares s
      join bonado.line_items li on li.id = s.line_item_id
      join bonado.entries e on e.id = li.entry_id
      where e.trip_id = p_trip_id and s.user_id = v_destination_id
      group by s.line_item_id
      having count(*) > 1
    )
    delete from bonado.line_item_shares s
    using grouped
    where s.line_item_id = grouped.line_item_id
      and s.user_id = v_destination_id
      and s.id <> grouped.keep_id;

    with grouped as (
      select s.adjustment_id, (array_agg(s.id order by s.id))[1] keep_id, sum(s.owed_amount) total
      from bonado.adjustment_shares s
      join bonado.adjustments a on a.id = s.adjustment_id
      join bonado.entries e on e.id = a.entry_id
      where e.trip_id = p_trip_id and s.user_id = v_destination_id
      group by s.adjustment_id
      having count(*) > 1
    )
    update bonado.adjustment_shares s
    set owed_amount = grouped.total
    from grouped
    where s.id = grouped.keep_id;

    with grouped as (
      select s.adjustment_id, (array_agg(s.id order by s.id))[1] keep_id
      from bonado.adjustment_shares s
      join bonado.adjustments a on a.id = s.adjustment_id
      join bonado.entries e on e.id = a.entry_id
      where e.trip_id = p_trip_id and s.user_id = v_destination_id
      group by s.adjustment_id
      having count(*) > 1
    )
    delete from bonado.adjustment_shares s
    using grouped
    where s.adjustment_id = grouped.adjustment_id
      and s.user_id = v_destination_id
      and s.id <> grouped.keep_id;
  end if;

  update bonado.settlements
  set created_by = v_destination_id
  where trip_id = p_trip_id and created_by = p_member_id;

  update bonado.entries
  set created_by = v_destination_id
  where trip_id = p_trip_id and created_by = p_member_id;

  update bonado.entries
  set last_edited_by = v_destination_id
  where trip_id = p_trip_id and last_edited_by = p_member_id;

  update bonado.entry_attachments attachment
  set uploaded_by = v_destination_id
  from bonado.entries entry
  where attachment.entry_id = entry.id
    and entry.trip_id = p_trip_id
    and attachment.uploaded_by = p_member_id;

  delete from bonado.memberships
  where trip_id = p_trip_id and user_id = p_member_id;

  if v_created_placeholder then
    insert into bonado.memberships (trip_id, user_id, role)
    values (p_trip_id, v_destination_id, 'member');
  end if;

  update bonado.trips
  set last_activity_at = now()
  where id = p_trip_id;

  return v_destination_id;
end;
$$;

revoke all on function bonado.remove_trip_member(uuid, uuid, uuid) from public, anon;
grant execute on function bonado.remove_trip_member(uuid, uuid, uuid) to authenticated;
