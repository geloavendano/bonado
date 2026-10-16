-- Run in a disposable database after migrations, with test.uid/member fixtures
-- from scripts/test-currency-settlements.mjs (npm run test:currency-settlements).
do $$
declare
  a uuid := '00000000-0000-0000-0000-000000000001';
  b uuid := '00000000-0000-0000-0000-000000000002';
  trip uuid := '00000000-0000-0000-0000-000000000003';
  e uuid; item uuid; s uuid; full_payment uuid; snapshot jsonb; n numeric;
begin
  insert into bonado.entries(trip_id,description,date,currency,exchange_rate_to_trip_default,created_by)
  values(trip,'PHP expense',current_date,'PHP',2.5,a) returning id into e;
  insert into bonado.payments(entry_id,user_id,amount_paid) values(e,a,1000);
  insert into bonado.line_items(entry_id,description,amount) values(e,'Share',1000) returning id into item;
  insert into bonado.line_item_shares(line_item_id,user_id,share_type,owed_amount) values(item,b,'exact',1000);
  insert into bonado.entries(trip_id,description,date,currency,exchange_rate_to_trip_default,created_by)
  values(trip,'JPY expense',current_date,'JPY',1,a) returning id into e;
  insert into bonado.payments(entry_id,user_id,amount_paid) values(e,a,10000);
  insert into bonado.line_items(entry_id,description,amount) values(e,'Share',10000) returning id into item;
  insert into bonado.line_item_shares(line_item_id,user_id,share_type,owed_amount) values(item,b,'exact',10000);

  -- Native PHP repayment ignores historical/current PHP→JPY differences.
  s := bonado.record_settlement_in_currency(trip,b,a,900,current_date,'Cash','Wallet','PHP','{"JPY":1,"PHP":3}');
  if (select currency from bonado.settlements where id=s)<>'PHP' or (select amount from bonado.settlements where id=s)<>900 then raise exception 'Payment currency/amount lost'; end if;
  if (select currency from bonado.payment_accounts where id=(select payment_account_id from bonado.settlements where id=s))<>'PHP' then raise exception 'Wrong account currency'; end if;
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='PHP')<>-100 then raise exception 'Expected PHP 100 remaining'; end if;
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='JPY')<>-10000 then raise exception 'JPY changed during PHP repayment'; end if;

  -- Same native currency is cleared first even when payment overflows into JPY.
  perform bonado.update_settlement_in_currency(s,trip,b,a,1100,current_date,'Cash','Wallet','PHP','{"JPY":1,"PHP":3}');
  if exists(select 1 from bonado.get_trip_currency_balances(trip) where currency='PHP') then raise exception 'PHP should be cleared'; end if;
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='JPY')<>-9700 then raise exception 'Excess PHP should clear JPY 300'; end if;
  -- Editing recalculates with the old payment excluded.
  perform bonado.update_settlement_in_currency(s,trip,b,a,900,current_date,'Cash','Wallet','PHP','{"JPY":1,"PHP":3}');
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='PHP')<>-100 then raise exception 'Edit double-counted old allocation'; end if;

  -- JPY 10,300 clears JPY 10,000 plus PHP 100 at the payment-time rate.
  full_payment := bonado.record_settlement_in_currency(trip,b,a,10300,current_date,'','','JPY','{"JPY":1,"PHP":3}');
  if exists(select 1 from bonado.get_trip_currency_balances(trip)) then raise exception 'Settle all left a native remainder'; end if;
  if exists(select 1 from bonado.get_trip_balances(trip) where balance<>0) then raise exception 'Settle all left a converted remainder'; end if;
  select allocations into snapshot from bonado.settlements where id=full_payment;
  -- Changing quotes, expense valuation, and payment metadata cannot reopen settled debts.
  insert into bonado.exchange_rate_cache(base_currency,target_currency,rate) values('JPY','PHP',0.2);
  update bonado.entries set exchange_rate_to_trip_default=4 where currency='PHP';
  perform bonado.update_settlement_in_currency(full_payment,trip,b,a,10300,current_date-1,'Cash','Other','JPY','{"JPY":1,"PHP":5}');
  if (select allocations from bonado.settlements where id=full_payment)<>snapshot then raise exception 'Metadata edit revalued payment'; end if;
  if exists(select 1 from bonado.get_trip_balances(trip) where balance<>0) then raise exception 'FX reopened a cleared balance'; end if;
  perform bonado.update_trip_settings(trip,'Japan',null,'PHP',null,'{"JPY":0.2,"PHP":1}');
  if (select amount from bonado.settlements where id=full_payment)<>10300 or (select currency from bonado.settlements where id=full_payment)<>'JPY' then raise exception 'Changing trip currency rewrote payment'; end if;
  if exists(select 1 from bonado.get_trip_currency_balances(trip)) then raise exception 'Rebase reopened native debt'; end if;

  -- Delete restores exactly the original balances cleared by that settlement.
  delete from bonado.settlements where id=full_payment;
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='PHP')<>-100 then raise exception 'Delete did not restore PHP'; end if;
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='JPY')<>-10000 then raise exception 'Delete did not restore JPY'; end if;

  -- An export in the payment's actual currency must remain exactly PHP 900.
  if exists(select 1 from bonado.export_trip_transactions(trip,'full','PHP')
    where parent_transaction_id=s and (paid_amount_currency is distinct from 'PHP'
      or paid_amount is distinct from 900 or equivalent_paid_amount is distinct from 900)) then
    raise exception 'Export converted an already-native payment';
  end if;

  -- Fully clear using a third currency, including a rounded equivalent.
  delete from bonado.settlements where trip_id=trip;
  perform bonado.update_trip_settings(trip,'Japan',null,'JPY',null,'{"JPY":1,"PHP":3}');
  full_payment := bonado.record_settlement_in_currency(trip,b,a,86.67,current_date,'','','USD','{"JPY":1,"PHP":3,"USD":150}');
  if exists(select 1 from bonado.get_trip_currency_balances(trip)) then raise exception 'Rounded third-currency settlement left dust'; end if;
  if (select jsonb_array_length(allocations) from bonado.settlements where id=full_payment)<>2 then raise exception 'Missing native allocations'; end if;
  -- Changing the payment currency on edit replaces the old allocations atomically.
  perform bonado.update_settlement_in_currency(full_payment,trip,b,a,4333.33,current_date,'Cash','Wallet','PHP','{"JPY":1,"PHP":3}');
  if exists(select 1 from bonado.get_trip_currency_balances(trip)) then raise exception 'Currency edit did not fully clear native balances'; end if;
  if (select currency from bonado.settlements where id=full_payment)<>'PHP' then raise exception 'Currency edit was ignored'; end if;

  -- Overpayments remain a credit; they are never silently discarded.
  delete from bonado.settlements where id=full_payment;
  full_payment := bonado.record_settlement_in_currency(trip,b,a,87,current_date,'','','USD','{"JPY":1,"PHP":3,"USD":150}');
  if (select balance from bonado.get_trip_currency_balances(trip) where user_id=b and currency='USD') is distinct from 0.33 then raise exception 'Overpayment credit lost'; end if;
  if exists(select 1 from bonado.get_trip_currency_balances(trip) where currency in ('PHP','JPY')) then raise exception 'Overpayment left old debts'; end if;
  if exists(select 1 from bonado.get_trip_currency_balances(trip) group by currency having sum(balance)<>0) then raise exception 'Native ledger does not conserve money'; end if;
  delete from bonado.settlements where id=full_payment;

  -- Older clients still clear native debts when paying the quoted trip total.
  select balance into n from bonado.get_trip_balances(trip) where user_id=a;
  full_payment := bonado.record_settlement(trip,b,a,n,current_date,'','');
  if exists(select 1 from bonado.get_trip_currency_balances(trip)) then raise exception 'Legacy recording API left FX dust'; end if;
  delete from bonado.settlements where id=full_payment;

  -- Missing rates reject the whole payment; membership checks apply to reads/writes.
  select count(*) into n from bonado.settlements;
  begin
    perform bonado.record_settlement_in_currency(trip,b,a,12000,current_date,'','','USD','{}');
    raise exception 'Missing FX should fail';
  exception when others then
    if sqlerrm='Missing FX should fail' then raise; end if;
  end;
  if (select count(*) from bonado.settlements)<>n then raise exception 'Failed payment was partially saved'; end if;
  if has_function_privilege('authenticated','bonado.trip_currency_balances_internal(uuid,uuid)','execute')
    or has_function_privilege('authenticated','bonado.allocate_settlement(uuid,uuid,uuid,numeric,text,jsonb,uuid)','execute')
    or has_function_privilege('anon','bonado.record_settlement_in_currency(uuid,uuid,uuid,numeric,date,text,text,text,jsonb)','execute') then
    raise exception 'Private helpers or settlement writes are exposed';
  end if;
  perform set_config('test.uid','',false);
  if exists(select 1 from bonado.get_trip_currency_balances(trip)) then raise exception 'Unauthorized ledger read'; end if;
  begin
    perform bonado.record_settlement_in_currency(trip,b,a,100,current_date,'','','PHP','{"PHP":1}');
    raise exception 'Non-member write should fail';
  exception when others then
    if sqlerrm='Non-member write should fail' then raise; end if;
  end;
end $$;
