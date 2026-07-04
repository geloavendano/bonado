-- Phase 15 Tier 1: remotely readable app configuration.
--
-- Shipped mobile binaries lag database changes, so the native shell checks
-- min_supported_native_version at launch and blocks hopelessly outdated
-- clients. Values are changed from the Supabase dashboard (service role);
-- the API roles get read-only access.

create table bonado.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table bonado.app_config enable row level security;
create policy "app_config_select" on bonado.app_config for select using (true);

insert into bonado.app_config (key, value)
values ('min_supported_native_version', '0.0.0');
