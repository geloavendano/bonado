-- Lightweight per-entry edit audit trail. This intentionally stores a compact
-- JSON array on entries instead of a normalized audit table; the UI can render
-- the human-readable history while keeping the backend simple.

alter table bonado.entries
  add column if not exists edit_log jsonb not null default '[]'::jsonb;

create or replace function bonado.entry_audit_snapshot(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_entry record;
  v_amount numeric;
  v_payers jsonb;
  v_distribution jsonb;
  v_items jsonb;
  v_adjustments jsonb;
begin
  select
    e.description,
    e.payee,
    e.currency,
    e.category_id,
    c.name as category_name
  into v_entry
  from bonado.entries e
  left join bonado.categories c on c.id = e.category_id
  where e.id = p_entry_id;

  select coalesce(sum(p.amount_paid), 0)
  into v_amount
  from bonado.payments p
  where p.entry_id = p_entry_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', p.user_id,
        'name', coalesce(u.name, 'Member'),
        'amount', p.amount_paid,
        'payment_account_id', p.payment_account_id,
        'method', pa.method,
        'label', pa.label
      )
      order by coalesce(u.name, ''), p.user_id::text, p.amount_paid::text
    ),
    '[]'::jsonb
  )
  into v_payers
  from bonado.payments p
  left join bonado.users u on u.id = p.user_id
  left join bonado.payment_accounts pa on pa.id = p.payment_account_id
  where p.entry_id = p_entry_id;

  with owed as (
    select lis.user_id, sum(lis.owed_amount) as amount
    from bonado.line_items li
    join bonado.line_item_shares lis on lis.line_item_id = li.id
    where li.entry_id = p_entry_id
    group by lis.user_id
    union all
    select ads.user_id, sum(ads.owed_amount) as amount
    from bonado.adjustments a
    join bonado.adjustment_shares ads on ads.adjustment_id = a.id
    where a.entry_id = p_entry_id
    group by ads.user_id
  ),
  totals as (
    select user_id, sum(amount) as amount
    from owed
    group by user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', t.user_id,
        'name', coalesce(u.name, 'Member'),
        'amount', t.amount
      )
      order by coalesce(u.name, ''), t.user_id::text
    ),
    '[]'::jsonb
  )
  into v_distribution
  from totals t
  left join bonado.users u on u.id = t.user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'description', li.description,
        'amount', li.amount,
        'shares', coalesce(shares.shares, '[]'::jsonb)
      )
      order by li.description, li.amount::text
    ),
    '[]'::jsonb
  )
  into v_items
  from bonado.line_items li
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'user_id', lis.user_id,
        'name', coalesce(u.name, 'Member'),
        'share_type', lis.share_type,
        'share_value', lis.share_value,
        'owed_amount', lis.owed_amount
      )
      order by coalesce(u.name, ''), lis.user_id::text
    ) as shares
    from bonado.line_item_shares lis
    left join bonado.users u on u.id = lis.user_id
    where lis.line_item_id = li.id
  ) shares on true
  where li.entry_id = p_entry_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', a.type,
        'mode', a.mode,
        'amount', a.amount,
        'shares', coalesce(shares.shares, '[]'::jsonb)
      )
      order by a.type, a.mode, a.amount::text
    ),
    '[]'::jsonb
  )
  into v_adjustments
  from bonado.adjustments a
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'user_id', ads.user_id,
        'name', coalesce(u.name, 'Member'),
        'owed_amount', ads.owed_amount
      )
      order by coalesce(u.name, ''), ads.user_id::text
    ) as shares
    from bonado.adjustment_shares ads
    left join bonado.users u on u.id = ads.user_id
    where ads.adjustment_id = a.id
  ) shares on true
  where a.entry_id = p_entry_id;

  return jsonb_build_object(
    'description', v_entry.description,
    'payee', v_entry.payee,
    'currency', v_entry.currency,
    'category_id', v_entry.category_id,
    'category_name', v_entry.category_name,
    'amount', v_amount,
    'payers', v_payers,
    'distribution', v_distribution,
    'line_items', v_items,
    'adjustments', v_adjustments
  );
end;
$$;

create or replace function bonado.append_entry_edit_log(
  p_entry_id uuid,
  p_changes jsonb
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_actor uuid;
  v_actor_name text;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    return;
  end if;

  v_actor := bonado.current_user_id();

  select name into v_actor_name
  from bonado.users
  where id = v_actor;

  update bonado.entries
  set edit_log = coalesce(edit_log, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'at', now(),
      'by', v_actor,
      'by_name', coalesce(v_actor_name, 'Member'),
      'changes', p_changes
    )
  )
  where id = p_entry_id;
end;
$$;

create or replace function bonado.entry_snapshot_diff(
  p_old jsonb,
  p_new jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_changes jsonb := '[]'::jsonb;
begin
  if p_old->'description' is distinct from p_new->'description' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'description',
      'from', p_old->'description',
      'to', p_new->'description'
    ));
  end if;

  if p_old->'payee' is distinct from p_new->'payee' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'payee',
      'from', p_old->'payee',
      'to', p_new->'payee'
    ));
  end if;

  if p_old->'currency' is distinct from p_new->'currency' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'currency',
      'from', p_old->'currency',
      'to', p_new->'currency'
    ));
  end if;

  if p_old->'category_id' is distinct from p_new->'category_id' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'category',
      'from', p_old->'category_name',
      'to', p_new->'category_name'
    ));
  end if;

  if p_old->'amount' is distinct from p_new->'amount' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'amount',
      'from', p_old->'amount',
      'to', p_new->'amount',
      'currency', p_new->'currency'
    ));
  end if;

  if p_old->'payers' is distinct from p_new->'payers' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'payers',
      'from', p_old->'payers',
      'to', p_new->'payers',
      'currency', p_new->'currency'
    ));
  end if;

  if p_old->'distribution' is distinct from p_new->'distribution' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'distribution',
      'from', p_old->'distribution',
      'to', p_new->'distribution',
      'currency', p_new->'currency'
    ));
  end if;

  if p_old->'line_items' is distinct from p_new->'line_items' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'line_items',
      'from', p_old->'line_items',
      'to', p_new->'line_items',
      'currency', p_new->'currency'
    ));
  end if;

  if p_old->'adjustments' is distinct from p_new->'adjustments' then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'field', 'adjustments',
      'from', p_old->'adjustments',
      'to', p_new->'adjustments',
      'currency', p_new->'currency'
    ));
  end if;

  return v_changes;
end;
$$;

create or replace function bonado.replace_expense_with_rate(
  p_entry_id uuid, p_trip_id uuid, p_amount numeric, p_currency text,
  p_exchange_rate numeric, p_description text, p_payee text, p_date date,
  p_category_id uuid, p_payers jsonb, p_items jsonb, p_adjustments jsonb
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb;
begin
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required';
  end if;

  v_before := bonado.entry_audit_snapshot(p_entry_id);

  perform bonado.replace_expense(
    p_entry_id, p_trip_id, p_amount, p_currency, p_description, p_payee,
    p_date, p_category_id, p_payers, p_items, p_adjustments
  );

  update bonado.entries
  set exchange_rate_to_trip_default = p_exchange_rate,
      rate_is_estimated = false
  where id = p_entry_id;

  v_after := bonado.entry_audit_snapshot(p_entry_id);
  v_changes := bonado.entry_snapshot_diff(v_before, v_after);
  perform bonado.append_entry_edit_log(p_entry_id, v_changes);

  perform bonado.notify_transaction_change('expense_edited', p_entry_id, null);
end;
$$;

revoke all on function bonado.replace_expense_with_rate(
  uuid, uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) from public;
grant execute on function bonado.replace_expense_with_rate(
  uuid, uuid, numeric, text, numeric, text, text, date, uuid, jsonb, jsonb, jsonb
) to authenticated;

create or replace function bonado.update_entry_display_timestamp(
  p_entry_id uuid,
  p_date date,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
declare
  v_trip_id uuid;
  v_old_date date;
  v_old_created_at timestamptz;
  v_changes jsonb := '[]'::jsonb;
begin
  if p_entry_id is null or p_date is null or p_created_at is null then
    raise exception 'Entry id, date, and timestamp are required';
  end if;

  select trip_id, date, created_at
  into v_trip_id, v_old_date, v_old_created_at
  from bonado.entries
  where id = p_entry_id
    and status = 'active';

  if v_trip_id is null then
    raise exception 'Entry not found';
  end if;

  if not bonado.is_trip_member(v_trip_id) then
    raise exception 'Only trip members can update entry order';
  end if;

  update bonado.entries
  set
    date = p_date,
    created_at = p_created_at,
    last_edited_by = bonado.current_user_id(),
    last_edited_at = now()
  where id = p_entry_id;

  if v_old_date is distinct from p_date or v_old_created_at is distinct from p_created_at then
    v_changes := jsonb_build_array(jsonb_build_object(
      'field', 'timestamp',
      'from', jsonb_build_object('date', v_old_date, 'created_at', v_old_created_at),
      'to', jsonb_build_object('date', p_date, 'created_at', p_created_at)
    ));
    perform bonado.append_entry_edit_log(p_entry_id, v_changes);
  end if;
end;
$$;

revoke all on function bonado.update_entry_display_timestamp(uuid, date, timestamptz) from public;
grant execute on function bonado.update_entry_display_timestamp(uuid, date, timestamptz) to authenticated;
