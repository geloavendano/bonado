import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const db=new PGlite();
try {
await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;`);
await db.exec(readFileSync(root+'/supabase/migrations/0001_init.sql','utf8'));
await db.exec(`alter table bonado.payment_accounts add column method text; alter table bonado.settlements add column if not exists payment_account_id uuid references bonado.payment_accounts; alter table bonado.settlements add column updated_at timestamptz; create function bonado.notify_transaction_change(text,uuid,uuid) returns void language sql as $$ select $$;`);
await db.exec(readFileSync(root+'/supabase/migrations/0016_settlement_history.sql','utf8'));
await db.exec(`
insert into auth.users values ('10000000-0000-0000-0000-000000000001');
insert into bonado.users(id,name,auth_id) values ('10000000-0000-0000-0000-000000000001','Legacy A','10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002','Legacy B',null);
insert into bonado.trips(id,name,default_currency,created_by) values ('10000000-0000-0000-0000-000000000003','Legacy','JPY','10000000-0000-0000-0000-000000000001');
insert into bonado.memberships(trip_id,user_id) select '10000000-0000-0000-0000-000000000003',id from bonado.users;
do $$ declare e uuid; i uuid; begin
insert into bonado.entries(trip_id,description,date,currency,exchange_rate_to_trip_default,created_by) values('10000000-0000-0000-0000-000000000003','Legacy PHP',current_date,'PHP',2,'10000000-0000-0000-0000-000000000001') returning id into e;
insert into bonado.payments(entry_id,user_id,amount_paid) values(e,'10000000-0000-0000-0000-000000000001',500);
insert into bonado.line_items(entry_id,description,amount) values(e,'Legacy',500) returning id into i;
insert into bonado.line_item_shares(line_item_id,user_id,share_type,owed_amount) values(i,'10000000-0000-0000-0000-000000000002','exact',500);
insert into bonado.entries(trip_id,description,date,currency,exchange_rate_to_trip_default,created_by) values('10000000-0000-0000-0000-000000000003','Legacy PHP 2',current_date,'PHP',3,'10000000-0000-0000-0000-000000000001') returning id into e;
insert into bonado.payments(entry_id,user_id,amount_paid) values(e,'10000000-0000-0000-0000-000000000001',500);
insert into bonado.line_items(entry_id,description,amount) values(e,'Legacy 2',500) returning id into i;
insert into bonado.line_item_shares(line_item_id,user_id,share_type,owed_amount) values(i,'10000000-0000-0000-0000-000000000002','exact',500);
insert into bonado.settlements(trip_id,from_user_id,to_user_id,amount,date,created_by) values('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',2500,current_date,'10000000-0000-0000-0000-000000000001');
end $$;
`);
await db.exec(readFileSync(root+'/supabase/migrations/0048_currency_settlements.sql','utf8'));
await db.exec("select set_config('test.uid','10000000-0000-0000-0000-000000000001',false)");
assert.equal((await db.query("select * from bonado.get_trip_currency_balances('10000000-0000-0000-0000-000000000003')")).rows.length,0,'Legacy settled payment must remain settled');
console.log('Legacy payment backfill passed');

console.log('Migration applied');
await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000001'); insert into bonado.users(id,name,auth_id) values ('00000000-0000-0000-0000-000000000001','A','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002','B',null); select set_config('test.uid','00000000-0000-0000-0000-000000000001',false); insert into bonado.trips(id,name,default_currency,created_by) values ('00000000-0000-0000-0000-000000000003','Japan','JPY','00000000-0000-0000-0000-000000000001'); insert into bonado.memberships(trip_id,user_id) select '00000000-0000-0000-0000-000000000003',id from bonado.users where id::text like '00000000%';`);
await db.exec(readFileSync(root+'/supabase/tests/currency_settlements.sql','utf8'));
console.log('Currency settlement SQL assertions passed');
} catch(e) { console.error(e.message); if(e.query) console.error(e.query.slice(0,600)); process.exitCode=1; } finally { await db.close(); }
