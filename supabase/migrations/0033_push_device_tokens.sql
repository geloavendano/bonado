-- Phase 15 Tier 3: push notification device registry + dispatch trigger.
--
-- Native apps upsert their FCM registration token after sign-in. A pg_net
-- trigger on notification inserts calls the push-dispatch edge function,
-- which resolves the recipient's tokens and sends via FCM. Delivery stays
-- dormant until the FIREBASE_SERVICE_ACCOUNT secret is configured for the
-- edge function; the trigger itself is fire-and-forget and never blocks the
-- transaction that created the notification.

create table bonado.device_tokens (
  token text primary key,
  user_id uuid not null references bonado.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index device_tokens_user_id_idx on bonado.device_tokens (user_id);

alter table bonado.device_tokens enable row level security;
create policy "device_tokens_own" on bonado.device_tokens for all
  using (user_id = bonado.current_user_id())
  with check (user_id = bonado.current_user_id());

create extension if not exists pg_net;

-- Fire-and-forget call to the push-dispatch edge function. The function
-- authenticates the request with the anon key (already public in every
-- client bundle) and does its own service-role lookups.
create or replace function bonado.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_url text;
  v_anon_key text;
begin
  select value into v_url from bonado.app_config where key = 'push_dispatch_url';
  select value into v_anon_key from bonado.app_config where key = 'push_dispatch_anon_key';
  if v_url is null or v_anon_key is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
exception when others then
  -- push delivery must never break the write that created the notification
  return new;
end;
$$;

create trigger notifications_push_dispatch
after insert on bonado.notifications
for each row execute function bonado.dispatch_push_notification();

revoke all on function bonado.dispatch_push_notification() from public, anon, authenticated;

-- Environment wiring (single-project setup; the anon key is public by
-- design — it ships in every client bundle).
insert into bonado.app_config (key, value) values
  ('push_dispatch_url', 'https://ljebzcgfydaknyekwlqv.supabase.co/functions/v1/push-dispatch'),
  ('push_dispatch_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZWJ6Y2dmeWRha255ZWt3bHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzMyNjUsImV4cCI6MjA5NTIwOTI2NX0.rXqFC1e-G5ojDdJQKCF5RgH1QwYQJ1Fn0t1mG_URZxo')
on conflict (key) do update set value = excluded.value, updated_at = now();
