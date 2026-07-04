-- Phase 14.2: allow trip members to delete settlements while retaining a
-- trip-level notification for the other people involved.

alter table bonado.notifications
drop constraint if exists notifications_kind_check;

alter table bonado.notifications
add constraint notifications_kind_check check (kind in (
  'expense_created', 'expense_edited', 'expense_deleted',
  'settlement_created', 'settlement_edited', 'settlement_deleted',
  'comment_added', 'comment_mention'
));

alter table bonado.notifications
drop constraint if exists notifications_check;

alter table bonado.notifications
add constraint notifications_check check (
  (
    kind = 'settlement_deleted'
    and num_nonnulls(entry_id, settlement_id) = 0
  )
  or
  (
    kind <> 'settlement_deleted'
    and num_nonnulls(entry_id, settlement_id) = 1
  )
);

-- Trip-level notifications have no transaction id, so include the trip in
-- deduplication to avoid merging notices from separate trips.
create or replace function bonado.notify_users(
  p_recipients uuid[],
  p_actor uuid,
  p_trip_id uuid,
  p_kind text,
  p_entry_id uuid,
  p_settlement_id uuid,
  p_comment_id uuid
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_recipient uuid;
begin
  for v_recipient in select distinct r from unnest(p_recipients) r loop
    continue when v_recipient is null or v_recipient = p_actor;

    update bonado.notifications
    set created_at = now(),
        actor_id = p_actor,
        comment_id = p_comment_id
    where user_id = v_recipient
      and trip_id = p_trip_id
      and kind = p_kind
      and read_at is null
      and entry_id is not distinct from p_entry_id
      and settlement_id is not distinct from p_settlement_id;

    if not found then
      insert into bonado.notifications (
        user_id, actor_id, trip_id, kind, entry_id, settlement_id, comment_id
      )
      values (
        v_recipient, p_actor, p_trip_id, p_kind,
        p_entry_id, p_settlement_id, p_comment_id
      );
    end if;
  end loop;
end;
$$;

create or replace function bonado.delete_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_trip_id uuid;
  v_recipients uuid[];
begin
  select trip_id
  into v_trip_id
  from bonado.settlements
  where id = p_settlement_id;

  if v_trip_id is null or not bonado.is_trip_member(v_trip_id) then
    raise exception 'You cannot delete this settlement';
  end if;

  v_recipients := array(
    select bonado.settlement_involved_users(p_settlement_id)
  );

  delete from bonado.settlements
  where id = p_settlement_id;

  update bonado.trips
  set last_activity_at = now()
  where id = v_trip_id;

  perform bonado.notify_users(
    v_recipients,
    bonado.current_user_id(),
    v_trip_id,
    'settlement_deleted',
    null,
    null,
    null
  );
end;
$$;

revoke all on function bonado.delete_settlement(uuid) from public, anon;
grant execute on function bonado.delete_settlement(uuid) to authenticated;

