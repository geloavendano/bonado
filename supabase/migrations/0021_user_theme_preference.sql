-- Per-user theme preference, defaulting to following the device's
-- prefers-color-scheme. Explicit "light"/"dark" overrides that.
alter table bonado.users
  add column theme_preference text not null default 'system'
    check (theme_preference in ('system', 'light', 'dark'));
