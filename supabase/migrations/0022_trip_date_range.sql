alter table bonado.trips
add column if not exists start_date date,
add column if not exists end_date date;

alter table bonado.trips
drop constraint if exists trips_date_range_check;

alter table bonado.trips
add constraint trips_date_range_check
check (start_date is null or end_date is null or end_date >= start_date);

create or replace function bonado.create_trip_with_dates(
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text,
  p_location_place_id text,
  p_location_lat double precision,
  p_location_lng double precision,
  p_cover_photo_attribution text,
  p_start_date date,
  p_end_date date
)
returns bonado.trips
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_trip bonado.trips;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid trip date range is required';
  end if;

  v_trip := bonado.create_trip(
    p_name, p_location_name, p_default_currency, p_cover_photo_url,
    p_location_place_id, p_location_lat, p_location_lng, p_cover_photo_attribution
  );

  update bonado.trips
  set start_date = p_start_date, end_date = p_end_date
  where id = v_trip.id
  returning * into v_trip;

  return v_trip;
end;
$$;

revoke all on function bonado.create_trip_with_dates(
  text, text, text, text, text, double precision, double precision, text, date, date
) from public;
grant execute on function bonado.create_trip_with_dates(
  text, text, text, text, text, double precision, double precision, text, date, date
) to authenticated;

create or replace function bonado.update_trip_settings_with_dates(
  p_trip_id uuid,
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text,
  p_rates jsonb,
  p_location_place_id text,
  p_location_lat double precision,
  p_location_lng double precision,
  p_start_date date,
  p_end_date date
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid trip date range is required';
  end if;

  perform bonado.update_trip_settings(
    p_trip_id, p_name, p_location_name, p_default_currency,
    p_cover_photo_url, p_rates, p_location_place_id, p_location_lat, p_location_lng
  );

  update bonado.trips
  set start_date = p_start_date, end_date = p_end_date
  where id = p_trip_id;
end;
$$;

revoke all on function bonado.update_trip_settings_with_dates(
  uuid, text, text, text, text, jsonb, text, double precision, double precision, date, date
) from public;
grant execute on function bonado.update_trip_settings_with_dates(
  uuid, text, text, text, text, jsonb, text, double precision, double precision, date, date
) to authenticated;
