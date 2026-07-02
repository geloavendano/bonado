-- Payment accounts are optional. When selected, the method controls account
-- type while payment_label stores the user's specific card/bank/account name.

do $migration$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef(
    'bonado.create_itemized_expense(uuid,numeric,text,text,text,date,uuid,jsonb,jsonb,jsonb)'::regprocedure
  );

  v_updated := replace(
    v_definition,
    $old$
    v_method := coalesce(nullif(trim(v_payer->>'payment_method'), ''), 'Cash');
    v_account_id := null;
    select id into v_account_id
    from bonado.payment_accounts
    where user_id = v_payer_id
      and lower(label) = lower(v_method)
      and currency = p_currency
    order by id
    limit 1;

    if v_account_id is null then
      insert into bonado.payment_accounts (user_id, type, label, currency, is_shared)
      values (
        v_payer_id,
        case
          when lower(v_method) = 'cash' then 'cash'
          when lower(v_method) = 'bank' then 'bank'
          else 'other'
        end,
        v_method,
        p_currency,
        false
      )
      returning id into v_account_id;
    end if;
$old$,
    $new$
    v_method := nullif(trim(v_payer->>'payment_method'), '');
    v_account_id := null;

    if v_method is not null then
      select id into v_account_id
      from bonado.payment_accounts
      where user_id = v_payer_id
        and lower(label) = lower(
          coalesce(nullif(trim(v_payer->>'payment_label'), ''), v_method)
        )
        and currency = p_currency
      order by id
      limit 1;

      if v_account_id is null then
        insert into bonado.payment_accounts (user_id, type, label, currency, is_shared)
        values (
          v_payer_id,
          case
            when lower(v_method) = 'cash' then 'cash'
            when lower(v_method) = 'bank' then 'bank'
            else 'other'
          end,
          coalesce(nullif(trim(v_payer->>'payment_label'), ''), v_method),
          p_currency,
          false
        )
        returning id into v_account_id;
      end if;
    end if;
$new$
  );

  if v_updated = v_definition then
    raise exception 'create_itemized_expense payment block was not found';
  end if;

  execute v_updated;
end;
$migration$;
