-- Bonado initial schema
-- Run against your own Supabase project (SQL editor or `supabase db push`).
-- Requires: Google provider enabled in Auth settings, Anonymous sign-ins
-- enabled (used for guest trip joins), and a "receipts" Storage bucket.

create extension if not exists pgcrypto;

-- =========================================================================
-- USERS
-- One row per person, registered or guest. Guests are backed by a Supabase
-- anonymous auth session (auth_id points at the anonymous auth.users row);
-- when a guest claims a full account, auth_id is repointed to the upgraded
-- auth.users row and claimed_from_guest_id records where they came from.
-- =========================================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  avatar_url text,
  is_registered boolean not null default false,
  auth_id uuid unique references auth.users (id) on delete set null,
  claimed_from_guest_id uuid references public.users (id) on delete set null,
  preferred_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create index users_auth_id_idx on public.users (auth_id);

-- =========================================================================
-- TRIPS
-- =========================================================================
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  default_currency text not null default 'USD',
  invite_link_token text not null unique default encode(gen_random_bytes(9), 'base64'),
  location_name text,
  location_place_id text,
  location_lat double precision,
  location_lng double precision,
  cover_photo_url text,
  cover_photo_attribution text,
  last_activity_at timestamptz not null default now()
);

create index trips_invite_link_token_idx on public.trips (invite_link_token);

-- =========================================================================
-- MEMBERSHIPS
-- =========================================================================
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  role text not null default 'member' check (role in ('owner', 'member')),
  unique (trip_id, user_id)
);

create index memberships_trip_id_idx on public.memberships (trip_id);
create index memberships_user_id_idx on public.memberships (user_id);

-- =========================================================================
-- CATEGORIES (fixed global list, seeded below)
-- =========================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null
);

-- =========================================================================
-- PAYMENT ACCOUNTS
-- =========================================================================
create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('cash', 'bank', 'other')),
  label text not null,
  currency text not null,
  is_shared boolean not null default false
);

create index payment_accounts_user_id_idx on public.payment_accounts (user_id);

-- =========================================================================
-- ENTRIES (expenses) — id is client-generated for offline-sync dedup
-- =========================================================================
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null,
  date date not null,
  currency text not null,
  exchange_rate_to_trip_default numeric not null default 1,
  rate_is_estimated boolean not null default false,
  category_id uuid references public.categories (id),
  payee text,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  server_created_at timestamptz not null default now(),
  last_edited_by uuid references public.users (id),
  last_edited_at timestamptz,
  sync_status text not null default 'synced' check (sync_status in ('pending', 'synced'))
);

create index entries_trip_id_idx on public.entries (trip_id);
create index entries_category_id_idx on public.entries (category_id);

-- =========================================================================
-- ENTRY ATTACHMENTS (receipt photos, in the "receipts" Storage bucket)
-- =========================================================================
create table public.entry_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references public.users (id),
  uploaded_at timestamptz not null default now(),
  server_uploaded_at timestamptz not null default now(),
  sync_status text not null default 'synced' check (sync_status in ('pending', 'synced'))
);

create index entry_attachments_entry_id_idx on public.entry_attachments (entry_id);

-- =========================================================================
-- PAYMENTS (who actually paid the merchant — supports multiple payers)
-- =========================================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references public.users (id),
  amount_paid numeric not null,
  payment_account_id uuid references public.payment_accounts (id)
);

create index payments_entry_id_idx on public.payments (entry_id);

-- =========================================================================
-- LINE ITEMS + SHARES (itemized split)
-- =========================================================================
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  description text not null,
  amount numeric not null
);

create index line_items_entry_id_idx on public.line_items (entry_id);

create table public.line_item_shares (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references public.line_items (id) on delete cascade,
  user_id uuid not null references public.users (id),
  share_type text not null check (share_type in ('equal', 'exact', 'percent', 'shares')),
  share_value numeric,
  owed_amount numeric not null
);

create index line_item_shares_line_item_id_idx on public.line_item_shares (line_item_id);

-- =========================================================================
-- ADJUSTMENTS + SHARES (tax, tip, service charge)
-- =========================================================================
create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  type text not null check (type in ('tax', 'tip', 'service_charge')),
  mode text not null check (mode in ('proportional', 'own_item')),
  amount numeric not null
);

create index adjustments_entry_id_idx on public.adjustments (entry_id);

create table public.adjustment_shares (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.adjustments (id) on delete cascade,
  user_id uuid not null references public.users (id),
  owed_amount numeric not null
);

create index adjustment_shares_adjustment_id_idx on public.adjustment_shares (adjustment_id);

-- =========================================================================
-- SETTLEMENTS
-- =========================================================================
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_user_id uuid not null references public.users (id),
  to_user_id uuid not null references public.users (id),
  amount numeric not null,
  date date not null default current_date,
  created_by uuid not null references public.users (id),
  payment_account_id uuid references public.payment_accounts (id)
);

create index settlements_trip_id_idx on public.settlements (trip_id);

-- =========================================================================
-- EXCHANGE RATE CACHE (Frankfurter API, refreshed daily by a scheduled job)
-- =========================================================================
create table public.exchange_rate_cache (
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
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_id = auth.uid()
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.trip_id = p_trip_id and m.user_id = public.current_user_id()
  )
$$;

create or replace function public.entry_trip_id(p_entry_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select trip_id from public.entries where id = p_entry_id
$$;

create or replace function public.line_item_trip_id(p_line_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.trip_id
  from public.line_items li
  join public.entries e on e.id = li.entry_id
  where li.id = p_line_item_id
$$;

create or replace function public.adjustment_trip_id(p_adjustment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.trip_id
  from public.adjustments a
  join public.entries e on e.id = a.entry_id
  where a.id = p_adjustment_id
$$;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.memberships enable row level security;
alter table public.categories enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.entries enable row level security;
alter table public.entry_attachments enable row level security;
alter table public.payments enable row level security;
alter table public.line_items enable row level security;
alter table public.line_item_shares enable row level security;
alter table public.adjustments enable row level security;
alter table public.adjustment_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.exchange_rate_cache enable row level security;

-- users: see your own row, or the profile of anyone who shares a trip with you
create policy "users_select" on public.users for select using (
  auth_id = auth.uid()
  or exists (
    select 1 from public.memberships m1
    join public.memberships m2 on m1.trip_id = m2.trip_id
    where m1.user_id = public.users.id and m2.user_id = public.current_user_id()
  )
);
create policy "users_insert_self" on public.users for insert with check (auth_id = auth.uid());
create policy "users_update_self" on public.users for update using (auth_id = auth.uid());

-- trips: members can read; creator can update/delete
create policy "trips_select" on public.trips for select using (public.is_trip_member(id));
create policy "trips_insert" on public.trips for insert with check (created_by = public.current_user_id());
create policy "trips_update" on public.trips for update using (public.is_trip_member(id));
create policy "trips_delete" on public.trips for delete using (created_by = public.current_user_id());

-- memberships: members can read; anyone can insert their own membership (join via invite link)
create policy "memberships_select" on public.memberships for select using (public.is_trip_member(trip_id));
create policy "memberships_insert" on public.memberships for insert with check (
  user_id = public.current_user_id() or public.is_trip_member(trip_id)
);
create policy "memberships_delete" on public.memberships for delete using (
  user_id = public.current_user_id() or public.is_trip_member(trip_id)
);

-- categories: public read-only fixed list
create policy "categories_select" on public.categories for select using (true);

-- payment_accounts: owner, or shared accounts visible to trip-mates
create policy "payment_accounts_select" on public.payment_accounts for select using (
  user_id = public.current_user_id()
  or (
    is_shared and exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.trip_id = m2.trip_id
      where m1.user_id = public.payment_accounts.user_id and m2.user_id = public.current_user_id()
    )
  )
);
create policy "payment_accounts_write" on public.payment_accounts for all
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- entries: any trip member can read/write
create policy "entries_select" on public.entries for select using (public.is_trip_member(trip_id));
create policy "entries_insert" on public.entries for insert with check (public.is_trip_member(trip_id));
create policy "entries_update" on public.entries for update using (public.is_trip_member(trip_id));

-- entry_attachments
create policy "entry_attachments_select" on public.entry_attachments for select using (
  public.is_trip_member(public.entry_trip_id(entry_id))
);
create policy "entry_attachments_insert" on public.entry_attachments for insert with check (
  public.is_trip_member(public.entry_trip_id(entry_id))
);
create policy "entry_attachments_delete" on public.entry_attachments for delete using (
  public.is_trip_member(public.entry_trip_id(entry_id))
);

-- payments
create policy "payments_all" on public.payments for all using (
  public.is_trip_member(public.entry_trip_id(entry_id))
) with check (
  public.is_trip_member(public.entry_trip_id(entry_id))
);

-- line_items
create policy "line_items_all" on public.line_items for all using (
  public.is_trip_member(public.entry_trip_id(entry_id))
) with check (
  public.is_trip_member(public.entry_trip_id(entry_id))
);

-- line_item_shares
create policy "line_item_shares_all" on public.line_item_shares for all using (
  public.is_trip_member(public.line_item_trip_id(line_item_id))
) with check (
  public.is_trip_member(public.line_item_trip_id(line_item_id))
);

-- adjustments
create policy "adjustments_all" on public.adjustments for all using (
  public.is_trip_member(public.entry_trip_id(entry_id))
) with check (
  public.is_trip_member(public.entry_trip_id(entry_id))
);

-- adjustment_shares
create policy "adjustment_shares_all" on public.adjustment_shares for all using (
  public.is_trip_member(public.adjustment_trip_id(adjustment_id))
) with check (
  public.is_trip_member(public.adjustment_trip_id(adjustment_id))
);

-- settlements
create policy "settlements_select" on public.settlements for select using (public.is_trip_member(trip_id));
create policy "settlements_insert" on public.settlements for insert with check (public.is_trip_member(trip_id));

-- exchange_rate_cache: public read, writes via service role only (no policy = locked)
create policy "exchange_rate_cache_select" on public.exchange_rate_cache for select using (true);

-- =========================================================================
-- Seed categories
-- =========================================================================
insert into public.categories (name, icon) values
  ('Food & drink', 'utensils'),
  ('Transport', 'car'),
  ('Lodging', 'bed'),
  ('Groceries', 'shopping-cart'),
  ('Activities', 'ticket'),
  ('Other', 'more-horizontal');
