-- Same RETURNING-vs-RLS chicken-and-egg problem as create_trip: right after
-- inserting your own membership row, RETURNING needs the memberships_select
-- policy (is_trip_member) to pass, and that self-referential visibility
-- isn't reliable within the same statement. Doing it inside a SECURITY
-- DEFINER function sidesteps RLS entirely for this internal insert.
create or replace function bonado.join_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_user_id uuid;
begin
  v_user_id := bonado.current_user_id();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into bonado.memberships (trip_id, user_id)
  values (p_trip_id, v_user_id)
  on conflict (trip_id, user_id) do nothing;
end;
$$;

grant execute on function bonado.join_trip(uuid) to authenticated;
