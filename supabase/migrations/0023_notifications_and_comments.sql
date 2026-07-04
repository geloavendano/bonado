-- Phase 11: transaction comments and unread notifications.
--
-- Comments attach to exactly one transaction (expense entry or settlement).
-- Notifications fan out to the users involved in a transaction (payers,
-- share holders, settlement from/to, creator) whenever it is created,
-- edited, deleted, or commented on — excluding the acting user. Mentioning
-- a member in a comment notifies them with a dedicated kind. Unread rows
-- are deduplicated per (recipient, kind, transaction) so repeated edits
-- bump one notification instead of stacking new ones.

-- =========================================================================
-- COMMENTS
-- =========================================================================
create table bonado.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references bonado.trips (id) on delete cascade,
  entry_id uuid references bonado.entries (id) on delete cascade,
  settlement_id uuid references bonado.settlements (id) on delete cascade,
  author_id uuid not null references bonado.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (num_nonnulls(entry_id, settlement_id) = 1)
);

create index comments_entry_id_idx on bonado.comments (entry_id);
create index comments_settlement_id_idx on bonado.comments (settlement_id);
create index comments_trip_id_idx on bonado.comments (trip_id);

create table bonado.comment_mentions (
  comment_id uuid not null references bonado.comments (id) on delete cascade,
  user_id uuid not null references bonado.users (id) on delete cascade,
  primary key (comment_id, user_id)
);

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
create table bonado.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references bonado.users (id) on delete cascade,
  actor_id uuid not null references bonado.users (id) on delete cascade,
  trip_id uuid not null references bonado.trips (id) on delete cascade,
  kind text not null check (kind in (
    'expense_created', 'expense_edited', 'expense_deleted',
    'settlement_created', 'settlement_edited',
    'comment_added', 'comment_mention'
  )),
  entry_id uuid references bonado.entries (id) on delete cascade,
  settlement_id uuid references bonado.settlements (id) on delete cascade,
  comment_id uuid references bonado.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (num_nonnulls(entry_id, settlement_id) = 1)
);

create index notifications_user_unread_idx
on bonado.notifications (user_id, created_at desc)
where read_at is null;

create index notifications_entry_id_idx on bonado.notifications (entry_id);
create index notifications_settlement_id_idx on bonado.notifications (settlement_id);
create index notifications_comment_id_idx on bonado.notifications (comment_id);
create index notifications_actor_id_idx on bonado.notifications (actor_id);
create index notifications_trip_id_idx on bonado.notifications (trip_id);

-- =========================================================================
-- Helpers
-- =========================================================================
create or replace function bonado.comment_trip_id(p_comment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select trip_id from bonado.comments where id = p_comment_id
$$;

-- Everyone with a stake in an expense: creator, payers, and share holders.
create or replace function bonado.entry_involved_users(p_entry_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select created_by from bonado.entries where id = p_entry_id
  union
  select user_id from bonado.payments where entry_id = p_entry_id
  union
  select s.user_id
  from bonado.line_item_shares s
  join bonado.line_items li on li.id = s.line_item_id
  where li.entry_id = p_entry_id
  union
  select s.user_id
  from bonado.adjustment_shares s
  join bonado.adjustments a on a.id = s.adjustment_id
  where a.entry_id = p_entry_id
$$;

create or replace function bonado.settlement_involved_users(p_settlement_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select person_id
  from bonado.settlements,
    unnest(array[from_user_id, to_user_id, created_by]) person_id
  where id = p_settlement_id
$$;

-- Internal fan-out. Skips the actor; bumps an existing unread notification
-- for the same (recipient, kind, transaction) instead of stacking a new one.
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

-- Internal: called from the transaction RPCs below after a successful write.
create or replace function bonado.notify_transaction_change(
  p_kind text,
  p_entry_id uuid,
  p_settlement_id uuid
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_actor uuid := bonado.current_user_id();
  v_trip_id uuid;
  v_recipients uuid[];
begin
  if p_entry_id is not null then
    v_trip_id := bonado.entry_trip_id(p_entry_id);
    v_recipients := array(select bonado.entry_involved_users(p_entry_id));
  else
    v_trip_id := (select trip_id from bonado.settlements where id = p_settlement_id);
    v_recipients := array(select bonado.settlement_involved_users(p_settlement_id));
  end if;
  if v_trip_id is null then
    return;
  end if;

  perform bonado.notify_users(
    v_recipients, v_actor, v_trip_id, p_kind, p_entry_id, p_settlement_id, null
  );
end;
$$;

revoke all on function bonado.comment_trip_id(uuid) from public, anon, authenticated;
revoke all on function bonado.entry_involved_users(uuid) from public, anon, authenticated;
revoke all on function bonado.settlement_involved_users(uuid) from public, anon, authenticated;
revoke all on function bonado.notify_users(uuid[], uuid, uuid, text, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function bonado.notify_transaction_change(text, uuid, uuid)
  from public, anon, authenticated;

-- =========================================================================
-- RLS — reads are direct; every write goes through the RPCs below, so no
-- insert/delete policies exist. Recipients may update (mark read) their own
-- notification rows.
-- =========================================================================
alter table bonado.comments enable row level security;
alter table bonado.comment_mentions enable row level security;
alter table bonado.notifications enable row level security;

create policy "comments_select" on bonado.comments for select using (
  bonado.is_trip_member(trip_id)
);

create policy "comment_mentions_select" on bonado.comment_mentions for select using (
  bonado.is_trip_member(bonado.comment_trip_id(comment_id))
);

create policy "notifications_select" on bonado.notifications for select using (
  user_id = bonado.current_user_id()
);
create policy "notifications_update" on bonado.notifications for update
  using (user_id = bonado.current_user_id())
  with check (user_id = bonado.current_user_id());

-- =========================================================================
-- Comment RPCs
-- =========================================================================
create or replace function bonado.add_comment(
  p_entry_id uuid,
  p_settlement_id uuid,
  p_body text,
  p_mentions uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_author uuid := bonado.current_user_id();
  v_trip_id uuid;
  v_body text := trim(p_body);
  v_comment_id uuid;
  v_mentioned uuid[];
  v_involved uuid[];
begin
  if num_nonnulls(p_entry_id, p_settlement_id) <> 1 then
    raise exception 'A comment needs exactly one transaction';
  end if;
  if v_body is null or v_body = '' then
    raise exception 'Comment cannot be empty';
  end if;
  if length(v_body) > 4000 then
    raise exception 'Comment is too long';
  end if;

  if p_entry_id is not null then
    select trip_id into v_trip_id
    from bonado.entries where id = p_entry_id and status = 'active';
  else
    select trip_id into v_trip_id
    from bonado.settlements where id = p_settlement_id;
  end if;
  if v_trip_id is null or not bonado.is_trip_member(v_trip_id) then
    raise exception 'You cannot comment on this transaction';
  end if;

  insert into bonado.comments (trip_id, entry_id, settlement_id, author_id, body)
  values (v_trip_id, p_entry_id, p_settlement_id, v_author, v_body)
  returning id into v_comment_id;

  -- only trip members can be mentioned, and mentioning yourself is a no-op
  insert into bonado.comment_mentions (comment_id, user_id)
  select v_comment_id, m.user_id
  from bonado.memberships m
  where m.trip_id = v_trip_id
    and m.user_id = any(coalesce(p_mentions, '{}'))
    and m.user_id <> v_author;

  v_mentioned := array(
    select user_id from bonado.comment_mentions where comment_id = v_comment_id
  );
  perform bonado.notify_users(
    v_mentioned, v_author, v_trip_id, 'comment_mention',
    p_entry_id, p_settlement_id, v_comment_id
  );

  if p_entry_id is not null then
    v_involved := array(
      select bonado.entry_involved_users(p_entry_id)
      except select unnest(v_mentioned)
    );
  else
    v_involved := array(
      select bonado.settlement_involved_users(p_settlement_id)
      except select unnest(v_mentioned)
    );
  end if;
  perform bonado.notify_users(
    v_involved, v_author, v_trip_id, 'comment_added',
    p_entry_id, p_settlement_id, v_comment_id
  );

  return v_comment_id;
end;
$$;

create or replace function bonado.update_comment(
  p_comment_id uuid,
  p_body text,
  p_mentions uuid[]
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_author uuid := bonado.current_user_id();
  v_body text := trim(p_body);
  v_comment bonado.comments;
  v_new_mentions uuid[];
begin
  select * into v_comment from bonado.comments where id = p_comment_id;
  if v_comment.id is null or v_comment.author_id is distinct from v_author then
    raise exception 'You can only edit your own comments';
  end if;
  if v_body is null or v_body = '' then
    raise exception 'Comment cannot be empty';
  end if;
  if length(v_body) > 4000 then
    raise exception 'Comment is too long';
  end if;

  update bonado.comments
  set body = v_body, edited_at = now()
  where id = p_comment_id;

  -- notify only members mentioned for the first time on this comment
  v_new_mentions := array(
    select m.user_id
    from bonado.memberships m
    where m.trip_id = v_comment.trip_id
      and m.user_id = any(coalesce(p_mentions, '{}'))
      and m.user_id <> v_author
      and not exists (
        select 1 from bonado.comment_mentions
        where comment_id = p_comment_id and user_id = m.user_id
      )
  );

  delete from bonado.comment_mentions
  where comment_id = p_comment_id
    and user_id <> all(coalesce(p_mentions, '{}'));

  insert into bonado.comment_mentions (comment_id, user_id)
  select p_comment_id, unnest(v_new_mentions);

  perform bonado.notify_users(
    v_new_mentions, v_author, v_comment.trip_id, 'comment_mention',
    v_comment.entry_id, v_comment.settlement_id, p_comment_id
  );
end;
$$;

create or replace function bonado.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  delete from bonado.comments
  where id = p_comment_id and author_id = bonado.current_user_id();
  if not found then
    raise exception 'You can only delete your own comments';
  end if;
end;
$$;

create or replace function bonado.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = bonado
as $$
  update bonado.notifications
  set read_at = now()
  where user_id = bonado.current_user_id() and read_at is null
$$;

revoke all on function bonado.add_comment(uuid, uuid, text, uuid[]) from public;
revoke all on function bonado.update_comment(uuid, text, uuid[]) from public;
revoke all on function bonado.delete_comment(uuid) from public;
revoke all on function bonado.mark_all_notifications_read() from public;
grant execute on function bonado.add_comment(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function bonado.update_comment(uuid, text, uuid[]) to authenticated;
grant execute on function bonado.delete_comment(uuid) to authenticated;
grant execute on function bonado.mark_all_notifications_read() to authenticated;

-- =========================================================================
-- Re-create the transaction RPCs with notification fan-out appended.
-- Bodies are repeated from 0012/0014/0017/0018; only the
-- notify_transaction_change calls are new.
-- =========================================================================
create or replace function bonado.create_itemized_expense_with_rate(
  p_trip_id uuid, p_amount numeric, p_currency text, p_exchange_rate numeric,
  p_description text, p_payee text, p_date date, p_category_id uuid,
  p_payers jsonb, p_items jsonb, p_adjustments jsonb
)
returns uuid language plpgsql security definer set search_path = bonado as $$
declare
  v_entry_id uuid;
begin
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required';
  end if;
  v_entry_id := bonado.create_itemized_expense(
    p_trip_id, p_amount, p_currency, p_description, p_payee, p_date,
    p_category_id, p_payers, p_items, p_adjustments
  );
  update bonado.entries
  set exchange_rate_to_trip_default = p_exchange_rate,
      rate_is_estimated = false
  where id = v_entry_id;
  perform bonado.notify_transaction_change('expense_created', v_entry_id, null);
  return v_entry_id;
end;
$$;

create or replace function bonado.replace_expense_with_rate(
  p_entry_id uuid, p_trip_id uuid, p_amount numeric, p_currency text,
  p_exchange_rate numeric, p_description text, p_payee text, p_date date,
  p_category_id uuid, p_payers jsonb, p_items jsonb, p_adjustments jsonb
)
returns void language plpgsql security definer set search_path = bonado as $$
begin
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required';
  end if;
  perform bonado.replace_expense(
    p_entry_id, p_trip_id, p_amount, p_currency, p_description, p_payee,
    p_date, p_category_id, p_payers, p_items, p_adjustments
  );
  update bonado.entries
  set exchange_rate_to_trip_default = p_exchange_rate,
      rate_is_estimated = false
  where id = p_entry_id;
  perform bonado.notify_transaction_change('expense_edited', p_entry_id, null);
end;
$$;

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
begin
  if not bonado.is_trip_member(bonado.entry_trip_id(p_entry_id)) then
    raise exception 'You cannot edit this expense';
  end if;
  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required';
  end if;

  update bonado.entries
  set description = trim(p_description),
      payee = nullif(trim(p_payee), ''),
      date = p_date,
      category_id = p_category_id,
      last_edited_by = bonado.current_user_id(),
      last_edited_at = now()
  where id = p_entry_id and status = 'active';

  if found then
    perform bonado.notify_transaction_change('expense_edited', p_entry_id, null);
  end if;
end;
$$;

create or replace function bonado.soft_delete_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if not bonado.is_trip_member(bonado.entry_trip_id(p_entry_id)) then
    raise exception 'You cannot delete this expense';
  end if;

  update bonado.entries
  set status = 'deleted',
      last_edited_by = bonado.current_user_id(),
      last_edited_at = now()
  where id = p_entry_id and status = 'active';

  if found then
    perform bonado.notify_transaction_change('expense_deleted', p_entry_id, null);
  end if;
end;
$$;

create or replace function bonado.record_settlement(
  p_trip_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_date date,
  p_payment_method text,
  p_payment_label text
)
returns uuid
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_settlement_id uuid;
  v_account_id uuid;
  v_method text;
  v_currency text;
begin
  if not bonado.is_trip_member(p_trip_id) then
    raise exception 'You are not a member of this trip';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be greater than zero';
  end if;
  if p_from_user_id = p_to_user_id then
    raise exception 'Settlement members must be different';
  end if;
  if exists (
    select 1
    from unnest(array[p_from_user_id, p_to_user_id]) person_id
    where not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = person_id
    )
  ) then
    raise exception 'Settlement members must belong to this trip';
  end if;

  select default_currency into v_currency from bonado.trips where id = p_trip_id;
  v_method := nullif(trim(p_payment_method), '');

  if v_method is not null then
    select id into v_account_id
    from bonado.payment_accounts
    where user_id = p_from_user_id
      and method = v_method
      and lower(label) = lower(coalesce(nullif(trim(p_payment_label), ''), v_method))
      and currency = v_currency
    order by id
    limit 1;

    if v_account_id is null then
      insert into bonado.payment_accounts (
        user_id, type, method, label, currency, is_shared
      )
      values (
        p_from_user_id,
        case
          when lower(v_method) = 'cash' then 'cash'
          when lower(v_method) = 'bank' then 'bank'
          else 'other'
        end,
        v_method,
        coalesce(nullif(trim(p_payment_label), ''), v_method),
        v_currency,
        false
      )
      returning id into v_account_id;
    end if;
  end if;

  insert into bonado.settlements (
    trip_id, from_user_id, to_user_id, amount, date, created_by, payment_account_id
  )
  values (
    p_trip_id, p_from_user_id, p_to_user_id, round(p_amount, 2),
    p_date, bonado.current_user_id(), v_account_id
  )
  returning id into v_settlement_id;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
  perform bonado.notify_transaction_change('settlement_created', null, v_settlement_id);
  return v_settlement_id;
end;
$$;

create or replace function bonado.update_settlement(
  p_settlement_id uuid,
  p_trip_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_date date,
  p_payment_method text,
  p_payment_label text
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_account_id uuid;
  v_method text;
  v_currency text;
begin
  if not bonado.is_trip_member(p_trip_id)
    or not exists (
      select 1 from bonado.settlements
      where id = p_settlement_id and trip_id = p_trip_id
    ) then
    raise exception 'You cannot edit this settlement';
  end if;
  if p_amount is null or p_amount <= 0 or p_from_user_id = p_to_user_id then
    raise exception 'Invalid settlement';
  end if;
  if exists (
    select 1
    from unnest(array[p_from_user_id, p_to_user_id]) person_id
    where not exists (
      select 1 from bonado.memberships
      where trip_id = p_trip_id and user_id = person_id
    )
  ) then
    raise exception 'Settlement members must belong to this trip';
  end if;

  select default_currency into v_currency from bonado.trips where id = p_trip_id;
  v_method := nullif(trim(p_payment_method), '');

  if v_method is not null then
    select id into v_account_id
    from bonado.payment_accounts
    where user_id = p_from_user_id
      and method = v_method
      and lower(label) = lower(coalesce(nullif(trim(p_payment_label), ''), v_method))
      and currency = v_currency
    limit 1;

    if v_account_id is null then
      insert into bonado.payment_accounts (
        user_id, type, method, label, currency, is_shared
      ) values (
        p_from_user_id,
        case when lower(v_method) = 'cash' then 'cash'
             when lower(v_method) = 'bank' then 'bank'
             else 'other' end,
        v_method,
        coalesce(nullif(trim(p_payment_label), ''), v_method),
        v_currency,
        false
      )
      returning id into v_account_id;
    end if;
  end if;

  update bonado.settlements
  set from_user_id = p_from_user_id,
      to_user_id = p_to_user_id,
      amount = round(p_amount, 2),
      date = p_date,
      payment_account_id = v_account_id,
      updated_at = now()
  where id = p_settlement_id and trip_id = p_trip_id;

  update bonado.trips set last_activity_at = now() where id = p_trip_id;
  perform bonado.notify_transaction_change('settlement_edited', null, p_settlement_id);
end;
$$;
