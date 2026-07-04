-- RLS policy expressions execute as the querying role, so is_trip_owner
-- (used by the trips_update policy in 0024) must be executable by the API
-- roles — matching is_trip_member and the other policy helpers.

grant execute on function bonado.is_trip_owner(uuid) to anon, authenticated;
