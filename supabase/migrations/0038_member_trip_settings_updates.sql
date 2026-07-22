-- Let any active trip member update trip-level settings while member
-- management remains protected by the existing owner-only RPCs/policies.
-- Direct trips table updates are still owner-only via 0024; this RPC keeps
-- currency rebasing centralized and safe.

create or replace function bonado.update_trip_settings(
  p_trip_id uuid,
  p_name text,
  p_location_name text,
  p_default_currency text,
  p_cover_photo_url text,
  p_rates jsonb,
  p_location_place_id text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_old_currency text;
begin
  if not bonado.is_trip_member(p_trip_id) then
    raise exception 'Only trip members can update trip settings';
  end if;
  if nullif(trim(p_name), '') is null or p_default_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid trip settings';
  end if;

  select default_currency into v_old_currency from bonado.trips where id = p_trip_id;
  if v_old_currency <> p_default_currency then
    if exists (
      select 1 from bonado.entries
      where trip_id = p_trip_id
        and status = 'active'
        and not (p_rates ? currency)
    ) then
      raise exception 'A conversion rate is required for every entry currency';
    end if;

    update bonado.entries
    set exchange_rate_to_trip_default = (p_rates ->> currency)::numeric,
        rate_is_estimated = true
    where trip_id = p_trip_id and status = 'active';

    update bonado.settlements
    set amount = round(amount * (p_rates ->> v_old_currency)::numeric, 2),
        updated_at = now()
    where trip_id = p_trip_id;
  end if;

  update bonado.trips
  set name = trim(p_name),
      location_name = nullif(trim(p_location_name), ''),
      location_place_id = nullif(trim(p_location_place_id), ''),
      location_lat = p_location_lat,
      location_lng = p_location_lng,
      default_currency = p_default_currency,
      cover_photo_url = nullif(trim(p_cover_photo_url), ''),
      last_activity_at = now()
  where id = p_trip_id;
end;
$$;

revoke all on function bonado.update_trip_settings(
  uuid, text, text, text, text, jsonb, text, double precision, double precision
) from public;
grant execute on function bonado.update_trip_settings(
  uuid, text, text, text, text, jsonb, text, double precision, double precision
) to authenticated;
