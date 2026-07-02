# Supabase setup

1. Create a project at https://supabase.com/dashboard (or reuse an existing one — bonado's tables live in their own `bonado` Postgres schema, so they don't collide with another app's tables in `public`).
2. **Database**: open the SQL editor and run `migrations/0001_init.sql` (or `supabase db push` if you're using the CLI and have linked this project). This creates the `bonado` schema, all tables, RLS policies, and grants.
3. **Settings → API → Exposed schemas**: add `bonado` to the list (alongside `public`) so PostgREST/the client library can reach it.
4. **Auth → Providers → Google**: enable it and add your Google OAuth client ID/secret. Redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
5. **Auth → Settings**: enable **Anonymous sign-ins** (used for guest trip joins in a later phase), and make sure `site_url` / the redirect allow-list cover your dev and production URLs.
6. **Storage**: create a bucket named `receipts` for expense photo attachments (private, accessed via signed URLs).
7. Copy `.env.example` to `.env.local` in the project root and fill in:
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Project Settings → API → anon public key

The app's Supabase client (`src/lib/supabase.ts`) is configured with `db: { schema: "bonado" }`, so `.from("trips")` etc. resolve against `bonado.trips` automatically — no schema prefix needed in app code.
