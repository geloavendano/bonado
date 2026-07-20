-- Add Shopping as a distinct expense category from Groceries.

insert into bonado.categories (name, icon)
select 'Shopping', 'shopping-bag'
where not exists (
  select 1 from bonado.categories where name = 'Shopping'
);
