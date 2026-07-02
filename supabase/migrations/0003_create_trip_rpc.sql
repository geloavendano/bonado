-- Atomic trip creation.
--
-- Inserting a trip then separately inserting its owner membership hits a
-- classic RLS chicken-and-egg problem: the trips_insert WITH CHECK passes,
-- but INSERT ... RETURNING also has to satisfy the trips_select policy
-- (is_trip_member), which is false until the membership row exists — so
-- the whole statement gets rejected with "new row violates row-level
-- security policy". Doing both inserts inside one SECURITY DEFINER
-- function sidesteps that, and as a bonus makes trip creation atomic
-- (no risk of an orphaned trip with no members if the client dies
-- between two separate insert calls).
create or replace function bonado.create_trip(
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text
)
returns bonado.trips
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_trip bonado.trips;
  v_user_id uuid;
begin
  v_user_id := bonado.current_user_id();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into bonado.trips (name, created_by, default_currency, location_name, cover_photo_url)
  values (p_name, v_user_id, p_default_currency, nullif(p_location_name, ''), p_cover_photo_url)
  returning * into v_trip;

  insert into bonado.memberships (trip_id, user_id, role)
  values (v_trip.id, v_user_id, 'owner');

  return v_trip;
end;
$$;

grant execute on function bonado.create_trip(text, text, text, text) to authenticated;
