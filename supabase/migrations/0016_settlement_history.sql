alter table bonado.settlements
add column if not exists created_at timestamptz not null default now();

create index if not exists settlements_trip_date_created_idx
on bonado.settlements (trip_id, date desc, created_at desc);
