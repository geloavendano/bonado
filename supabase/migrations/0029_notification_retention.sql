-- Phase 14.13: keep notification storage bounded. Comments and transaction
-- history remain untouched; only delivery/read-state rows expire.

create extension if not exists pg_cron with schema extensions;

create or replace function bonado.purge_expired_notifications()
returns bigint
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_deleted bigint;
begin
  delete from bonado.notifications
  where created_at < now() - interval '6 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function bonado.purge_expired_notifications()
from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'bonado-purge-expired-notifications';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'bonado-purge-expired-notifications',
    '15 3 * * *',
    'select bonado.purge_expired_notifications()'
  );
end;
$$;

