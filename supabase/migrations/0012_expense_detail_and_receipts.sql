-- Phase 7: safe metadata edits, soft deletion, and private receipt storage.

create or replace function bonado.update_entry_details(
  p_entry_id uuid,
  p_description text,
  p_payee text,
  p_date date,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if not bonado.is_trip_member(bonado.entry_trip_id(p_entry_id)) then
    raise exception 'You cannot edit this expense';
  end if;
  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required';
  end if;

  update bonado.entries
  set description = trim(p_description),
      payee = nullif(trim(p_payee), ''),
      date = p_date,
      category_id = p_category_id,
      last_edited_by = bonado.current_user_id(),
      last_edited_at = now()
  where id = p_entry_id and status = 'active';
end;
$$;

create or replace function bonado.soft_delete_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = bonado
as $$
begin
  if not bonado.is_trip_member(bonado.entry_trip_id(p_entry_id)) then
    raise exception 'You cannot delete this expense';
  end if;

  update bonado.entries
  set status = 'deleted',
      last_edited_by = bonado.current_user_id(),
      last_edited_at = now()
  where id = p_entry_id and status = 'active';
end;
$$;

revoke all on function bonado.update_entry_details(uuid, text, text, date, uuid) from public;
revoke all on function bonado.soft_delete_entry(uuid) from public;
grant execute on function bonado.update_entry_details(uuid, text, text, date, uuid) to authenticated;
grant execute on function bonado.soft_delete_entry(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

create policy "receipts_insert_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "receipts_select_trip_member" on storage.objects
for select to authenticated
using (
  bucket_id = 'receipts'
  and exists (
    select 1
    from bonado.entry_attachments attachment
    where attachment.storage_path = storage.objects.name
      and bonado.is_trip_member(bonado.entry_trip_id(attachment.entry_id))
  )
);

create policy "receipts_delete_uploader" on storage.objects
for delete to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
