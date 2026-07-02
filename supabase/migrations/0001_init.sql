-- Bonado initial schema
-- Run against your own Supabase project (SQL editor or `supabase db push`).
-- Requires: Google provider enabled in Auth settings, Anonymous sign-ins
-- enabled (used for guest trip joins), a "receipts" Storage bucket, and
-- "bonado" added to the API's exposed schemas (Settings -> API).
--
-- All bonado tables live in their own "bonado" schema rather than "public"
-- so they stay cleanly separated from any other app sharing this project.

create schema if not exists bonado;

-- =========================================================================
-- USERS
-- One row per person, registered or guest. Guests are backed by a Supabase
-- anonymous auth session (auth_id points at the anonymous auth.users row);
-- when a guest claims a full account, auth_id is repointed to the upgraded
-- auth.users row and claimed_from_guest_id records where they came from.
-- =========================================================================
create table bonado.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  avatar_url text,
  is_registered boolean not null default false,
  auth_id uuid unique references auth.users (id) on delete set null,
  claimed_from_guest_id uuid references bonado.users (id) on delete set null,
  preferred_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create index users_auth_id_idx on bonado.users (auth_id);

-- =========================================================================
-- TRIPS
-- =========================================================================
create table bonado.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references bonado.users (id),
  created_at timestamptz not null default now(),
  default_currency text not null default 'USD',
  invite_link_token text not null unique default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12),
  location_name text,
  location_place_id text,
  location_lat double precision,
  location_lng double precision,
  cover_photo_url text,
  cover_photo_attribution text,
  last_activity_at timestamptz not null default now()
);

create index trips_invite_link_token_idx on bonado.trips (invite_link_token);

-- =========================================================================
-- MEMBERSHIPS
-- =========================================================================
create table bonado.memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references bonado.trips (id) on delete cascade,
  user_id uuid not null references bonado.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  role text not null default 'member' check (role in ('owner', 'member')),
  unique (trip_id, user_id)
);

create index memberships_trip_id_idx on bonado.memberships (trip_id);
create index memberships_user_id_idx on bonado.memberships (user_id);

-- =========================================================================
-- CATEGORIES (fixed global list, seeded below)
-- =========================================================================
create table bonado.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null
);

-- =========================================================================
-- PAYMENT ACCOUNTS
-- =========================================================================
create table bonado.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references bonado.users (id) on delete cascade,
  type text not null check (type in ('cash', 'bank', 'other')),
  label text not null,
  currency text not null,
  is_shared boolean not null default false
);

create index payment_accounts_user_id_idx on bonado.payment_accounts (user_id);

-- =========================================================================
-- ENTRIES (expenses) — id is client-generated for offline-sync dedup
-- =========================================================================
create table bonado.entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references bonado.trips (id) on delete cascade,
  description text not null,
  date date not null,
  currency text not null,
  exchange_rate_to_trip_default numeric not null default 1,
  rate_is_estimated boolean not null default false,
  category_id uuid references bonado.categories (id),
  payee text,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_by uuid not null references bonado.users (id),
  created_at timestamptz not null default now(),
  server_created_at timestamptz not null default now(),
  last_edited_by uuid references bonado.users (id),
  last_edited_at timestamptz,
  sync_status text not null default 'synced' check (sync_status in ('pending', 'synced'))
);

create index entries_trip_id_idx on bonado.entries (trip_id);
create index entries_category_id_idx on bonado.entries (category_id);

-- =========================================================================
-- ENTRY ATTACHMENTS (receipt photos, in the "receipts" Storage bucket)
-- =========================================================================
create table bonado.entry_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references bonado.entries (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references bonado.users (id),
  uploaded_at timestamptz not null default now(),
  server_uploaded_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (sync_status in ('pending', 'synced'))
);

create index entry_attachments_entry_id_idx on bonado.entry_attachments (entry_id);

-- =========================================================================
-- PAYMENTS (who actually paid the merchant — supports multiple payers)
-- =========================================================================
create table bonado.payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references bonado.entries (id) on delete cascade,
  user_id uuid not null references bonado.users (id),
  amount_paid numeric not null,
  payment_account_id uuid references bonado.payment_accounts (id)
);

create index payments_entry_id_idx on bonado.payments (entry_id);

-- =========================================================================
-- LINE ITEMS + SHARES (itemized split)
-- =========================================================================
create table bonado.line_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references bonado.entries (id) on delete cascade,
  description text not null,
  amount numeric not null
);

create index line_items_entry_id_idx on bonado.line_items (entry_id);

create table bonado.line_item_shares (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references bonado.line_items (id) on delete cascade,
  user_id uuid not null references bonado.users (id),
  share_type text not null check (share_type in ('equal', 'exact', 'percent', 'shares')),
  share_value numeric,
  owed_amount numeric not null
);

create index line_item_shares_line_item_id_idx on bonado.line_item_shares (line_item_id);

-- =========================================================================
-- ADJUSTMENTS + SHARES (tax, tip, service charge)
-- =========================================================================
create table bonado.adjustments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references bonado.entries (id) on delete cascade,
  type text not null check (type in ('tax', 'tip', 'service_charge')),
  mode text not null check (mode in ('proportional', 'own_item')),
  amount numeric not null
);

create index adjustments_entry_id_idx on bonado.adjustments (entry_id);

create table bonado.adjustment_shares (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references bonado.adjustments (id) on delete cascade,
  user_id uuid not null references bonado.users (id),
  owed_amount numeric not null
);

create index adjustment_shares_adjustment_id_idx on bonado.adjustment_shares (adjustment_id);

-- =========================================================================
-- SETTLEMENTS
-- =========================================================================
create table bonado.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references bonado.trips (id) on delete cascade,
  from_user_id uuid not null references bonado.users (id),
  to_user_id uuid not null references bonado.users (id),
  amount numeric not null,
  date date not null default current_date,
  created_by uuid not null references bonado.users (id),
  payment_account_id uuid references bonado.payment_accounts (id)
);

create index settlements_trip_id_idx on bonado.settlements (trip_id);

-- =========================================================================
-- EXCHANGE RATE CACHE (Frankfurter API, refreshed daily by a scheduled job)
-- =========================================================================
create table bonado.exchange_rate_cache (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  target_currency text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  unique (base_currency, target_currency)
);

-- =========================================================================
-- Helper functions for RLS
-- =========================================================================
create or replace function bonado.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select id from bonado.users where auth_id = auth.uid()
$$;

create or replace function bonado.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = bonado
as $$
  select exists (
    select 1 from bonado.memberships m
    where m.trip_id = p_trip_id and m.user_id = bonado.current_user_id()
  )
$$;

create or replace function bonado.entry_trip_id(p_entry_id uuid)
returns uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select trip_id from bonado.entries where id = p_entry_id
$$;

create or replace function bonado.line_item_trip_id(p_line_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select e.trip_id
  from bonado.line_items li
  join bonado.entries e on e.id = li.entry_id
  where li.id = p_line_item_id
$$;

create or replace function bonado.adjustment_trip_id(p_adjustment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = bonado
as $$
  select e.trip_id
  from bonado.adjustments a
  join bonado.entries e on e.id = a.entry_id
  where a.id = p_adjustment_id
$$;

-- =========================================================================
-- RLS
-- =========================================================================
alter table bonado.users enable row level security;
alter table bonado.trips enable row level security;
alter table bonado.memberships enable row level security;
alter table bonado.categories enable row level security;
alter table bonado.payment_accounts enable row level security;
alter table bonado.entries enable row level security;
alter table bonado.entry_attachments enable row level security;
alter table bonado.payments enable row level security;
alter table bonado.line_items enable row level security;
alter table bonado.line_item_shares enable row level security;
alter table bonado.adjustments enable row level security;
alter table bonado.adjustment_shares enable row level security;
alter table bonado.settlements enable row level security;
alter table bonado.exchange_rate_cache enable row level security;

-- users: see your own row, or the profile of anyone who shares a trip with you
create policy "users_select" on bonado.users for select using (
  auth_id = auth.uid()
  or exists (
    select 1 from bonado.memberships m1
    join bonado.memberships m2 on m1.trip_id = m2.trip_id
    where m1.user_id = bonado.users.id and m2.user_id = bonado.current_user_id()
  )
);
create policy "users_insert_self" on bonado.users for insert with check (auth_id = auth.uid());
create policy "users_update_self" on bonado.users for update using (auth_id = auth.uid());

-- trips: members can read; creator can update/delete
create policy "trips_select" on bonado.trips for select using (bonado.is_trip_member(id));
create policy "trips_insert" on bonado.trips for insert with check (created_by = bonado.current_user_id());
create policy "trips_update" on bonado.trips for update using (bonado.is_trip_member(id));
create policy "trips_delete" on bonado.trips for delete using (created_by = bonado.current_user_id());

-- memberships: members can read; anyone can insert their own membership (join via invite link)
create policy "memberships_select" on bonado.memberships for select using (bonado.is_trip_member(trip_id));
create policy "memberships_insert" on bonado.memberships for insert with check (
  user_id = bonado.current_user_id() or bonado.is_trip_member(trip_id)
);
create policy "memberships_delete" on bonado.memberships for delete using (
  user_id = bonado.current_user_id() or bonado.is_trip_member(trip_id)
);

-- categories: public read-only fixed list
create policy "categories_select" on bonado.categories for select using (true);

-- payment_accounts: owner, or shared accounts visible to trip-mates
create policy "payment_accounts_select" on bonado.payment_accounts for select using (
  user_id = bonado.current_user_id()
  or (
    is_shared and exists (
      select 1 from bonado.memberships m1
      join bonado.memberships m2 on m1.trip_id = m2.trip_id
      where m1.user_id = bonado.payment_accounts.user_id and m2.user_id = bonado.current_user_id()
    )
  )
);
create policy "payment_accounts_write" on bonado.payment_accounts for all
  using (user_id = bonado.current_user_id())
  with check (user_id = bonado.current_user_id());

-- entries: any trip member can read/write
create policy "entries_select" on bonado.entries for select using (bonado.is_trip_member(trip_id));
create policy "entries_insert" on bonado.entries for insert with check (bonado.is_trip_member(trip_id));
create policy "entries_update" on bonado.entries for update using (bonado.is_trip_member(trip_id));

-- entry_attachments
create policy "entry_attachments_select" on bonado.entry_attachments for select using (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
);
create policy "entry_attachments_insert" on bonado.entry_attachments for insert with check (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
);
create policy "entry_attachments_delete" on bonado.entry_attachments for delete using (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
);

-- payments
create policy "payments_all" on bonado.payments for all using (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
) with check (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
);

-- line_items
create policy "line_items_all" on bonado.line_items for all using (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
) with check (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
);

-- line_item_shares
create policy "line_item_shares_all" on bonado.line_item_shares for all using (
  bonado.is_trip_member(bonado.line_item_trip_id(line_item_id))
) with check (
  bonado.is_trip_member(bonado.line_item_trip_id(line_item_id))
);

-- adjustments
create policy "adjustments_all" on bonado.adjustments for all using (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
) with check (
  bonado.is_trip_member(bonado.entry_trip_id(entry_id))
);

-- adjustment_shares
create policy "adjustment_shares_all" on bonado.adjustment_shares for all using (
  bonado.is_trip_member(bonado.adjustment_trip_id(adjustment_id))
) with check (
  bonado.is_trip_member(bonado.adjustment_trip_id(adjustment_id))
);

-- settlements
create policy "settlements_select" on bonado.settlements for select using (bonado.is_trip_member(trip_id));
create policy "settlements_insert" on bonado.settlements for insert with check (bonado.is_trip_member(trip_id));

-- exchange_rate_cache: public read, writes via service role only (no policy = locked)
create policy "exchange_rate_cache_select" on bonado.exchange_rate_cache for select using (true);

-- =========================================================================
-- Seed categories
-- =========================================================================
insert into bonado.categories (name, icon) values
  ('Food & drink', 'utensils'),
  ('Transport', 'car'),
  ('Lodging', 'bed'),
  ('Groceries', 'shopping-cart'),
  ('Activities', 'ticket'),
  ('Other', 'more-horizontal');

-- =========================================================================
-- Grants — a non-"public" schema isn't reachable by PostgREST's API roles
-- by default, so these need to be explicit (RLS still applies on top).
-- =========================================================================
grant usage on schema bonado to anon, authenticated, service_role;
grant all on all tables in schema bonado to anon, authenticated, service_role;
grant all on all sequences in schema bonado to anon, authenticated, service_role;
grant all on all functions in schema bonado to anon, authenticated, service_role;
alter default privileges in schema bonado grant all on tables to anon, authenticated, service_role;
alter default privileges in schema bonado grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema bonado grant all on functions to anon, authenticated, service_role;
