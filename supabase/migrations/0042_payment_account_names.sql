-- Optional recipient account name for settlement instructions.

alter table bonado.payment_accounts
  add column if not exists account_name text;
