-- The SECURITY DEFINER balance aggregate must still enforce trip membership.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef(
    'bonado.get_trip_balances(uuid)'::regprocedure
  );
  v_updated := replace(
    v_definition,
    'where m.trip_id = p_trip_id',
    'where m.trip_id = p_trip_id and bonado.is_trip_member(p_trip_id)'
  );
  if v_updated = v_definition then
    raise exception 'get_trip_balances membership clause was not found';
  end if;
  execute v_updated;
end;
$migration$;
