# Supabase setup

1. Create a project at https://supabase.com/dashboard (or reuse an existing one — bonado's tables live in their own `bonado` Postgres schema, so they don't collide with another app's tables in `public`).
2. **Database**: open the SQL editor and run all files in `migrations/` in order (or `supabase db push` if you're using the CLI and have linked this project). This creates the `bonado` schema, tables, RLS policies, grants, and RPC functions.
3. **Settings → API → Exposed schemas**: add `bonado` to the list (alongside `public`) so PostgREST/the client library can reach it.
4. **Auth → Providers → Google**: enable it and add your Google OAuth client ID/secret. Redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
5. **Auth → Settings**: enable **Anonymous sign-ins** (guest trip joins) and **Manual linking** (lets a guest claim a full account via `supabase.auth.linkIdentity`). Make sure `site_url` / the redirect allow-list cover your dev and production URLs.
6. **Storage**: create two buckets —
   - `receipts` (private, accessed via signed URLs) for expense photo attachments.
   - `trip-covers` (public) for user-uploaded trip cover photos. RLS policies (own-folder upload) are in `migrations/0002_invite_preview_and_covers.sql`.
7. Copy `.env.example` to `.env.local` in the project root and fill in:
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Project Settings → API → anon public key

The app's Supabase client (`src/lib/supabase.ts`) is configured with `db: { schema: "bonado" }`, so `.from("trips")` etc. resolve against `bonado.trips` automatically — no schema prefix needed in app code.

## RPC functions

A few operations are wrapped in `SECURITY DEFINER` RPC functions instead of
plain `.insert()` calls, because Postgres RLS's `RETURNING` clause also has
to satisfy the table's `SELECT` policy — and right after inserting (e.g.) a
trip, the row you just made doesn't satisfy `is_trip_member` yet, since its
own membership row doesn't exist until a *second* insert. Doing both in one
`SECURITY DEFINER` function sidesteps that:

- `get_trip_preview(token)` — invite-link preview, callable while signed out.
- `create_trip(...)` — creates a trip + owner membership atomically.
- `join_trip(trip_id)` — creates the caller's own membership row.

If you add a similar "insert a row that grants yourself access to itself"
flow later, follow the same pattern rather than a plain `.insert().select()`.
