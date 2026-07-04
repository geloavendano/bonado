-- Phase 14.1: restrict direct trip row updates to the trip owner.
--
-- The original trips_update policy allowed any trip member to update any
-- column of bonado.trips via PostgREST, bypassing the owner-only check and
-- the currency-rebasing logic in update_trip_settings (a member changing
-- default_currency directly would silently corrupt balance math). All
-- legitimate writes go through SECURITY DEFINER RPCs, which this does not
-- affect; the app performs no direct trips updates.

create or replace function bonado.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = bonado
as $$
  select exists (
    select 1 from bonado.memberships m
    where m.trip_id = p_trip_id
      and m.user_id = bonado.current_user_id()
      and m.role = 'owner'
  )
$$;

revoke all on function bonado.is_trip_owner(uuid) from public, anon, authenticated;

drop policy "trips_update" on bonado.trips;
create policy "trips_update" on bonado.trips for update
  using (bonado.is_trip_owner(id))
  with check (bonado.is_trip_owner(id));
