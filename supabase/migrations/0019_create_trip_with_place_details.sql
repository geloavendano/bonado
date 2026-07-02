-- Extend create_trip to capture the resolved place (from Google Places) and
-- cover photo attribution (required by Unsplash's API guidelines) alongside
-- the fields it already accepted.

drop function if exists bonado.create_trip(text, text, text, text);

create function bonado.create_trip(
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text,
  p_location_place_id text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_cover_photo_attribution text default null
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

  insert into bonado.trips (
    name, created_by, default_currency, location_name, cover_photo_url,
    location_place_id, location_lat, location_lng, cover_photo_attribution
  )
  values (
    p_name, v_user_id, p_default_currency, nullif(p_location_name, ''), p_cover_photo_url,
    nullif(p_location_place_id, ''), p_location_lat, p_location_lng, p_cover_photo_attribution
  )
  returning * into v_trip;

  insert into bonado.memberships (trip_id, user_id, role)
  values (v_trip.id, v_user_id, 'owner');

  return v_trip;
end;
$$;

grant execute on function bonado.create_trip(
  text, text, text, text, text, double precision, double precision, text
) to authenticated;
