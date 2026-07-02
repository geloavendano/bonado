-- Invite-link trip preview (Phase 4: guest join) and cover photo storage (Phase 2: create trip).

-- =========================================================================
-- Trip preview by invite token — callable by anyone (even signed-out
-- visitors), without granting broader read access to the trips table.
-- Returns only what the guest-join landing page needs.
-- =========================================================================
create or replace function bonado.get_trip_preview(p_token text)
returns table (
  trip_id uuid,
  name text,
  location_name text,
  cover_photo_url text,
  member_count integer,
  members jsonb
)
language sql
stable
security definer
set search_path = bonado
as $$
  select
    t.id,
    t.name,
    t.location_name,
    t.cover_photo_url,
    (select count(*) from bonado.memberships m where m.trip_id = t.id)::int,
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url)), '[]'::jsonb)
      from (
        select u2.id, u2.name, u2.avatar_url
        from bonado.memberships m2
        join bonado.users u2 on u2.id = m2.user_id
        where m2.trip_id = t.id
        order by m2.joined_at
        limit 5
      ) u
    )
  from bonado.trips t
  where t.invite_link_token = p_token
$$;

grant execute on function bonado.get_trip_preview(text) to anon, authenticated;

-- =========================================================================
-- Storage: trip cover photo uploads ("Own" tile on the create-trip screen).
-- Bucket itself (public, so cover photos are visible on the guest-join
-- landing page before anyone signs in) is created separately via the
-- Storage API — see supabase/README.md.
-- =========================================================================
create policy "trip_covers_insert_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'trip-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "trip_covers_select" on storage.objects
for select using (bucket_id = 'trip-covers');
