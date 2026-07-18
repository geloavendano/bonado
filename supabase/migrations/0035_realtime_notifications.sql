-- Phase 15 follow-up: foreground in-app notifications.
--
-- The notifications table already stores per-user unread activity, but the
-- client only refreshed on mount/focus. Publish it to Supabase Realtime so
-- foreground TestFlight sessions can update the bell as new trip activity
-- involving the user arrives.

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'bonado'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table bonado.notifications;
  end if;
end $$;
