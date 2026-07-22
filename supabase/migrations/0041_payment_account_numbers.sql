-- Settlement receiving options shown to tripmates when recording settlements.
-- Shared payment accounts can now carry a copyable account number/reference.

alter table bonado.payment_accounts
  add column if not exists account_number text;
