# Supabase setup

1. Create a project at https://supabase.com/dashboard.
2. **Database**: open the SQL editor and run `migrations/0001_init.sql` (or `supabase db push` if you're using the CLI and have linked this project).
3. **Auth → Providers → Google**: enable it and add your Google OAuth client ID/secret.
4. **Auth → Settings**: enable **Anonymous sign-ins** (used for guest trip joins in a later phase).
5. **Storage**: create a bucket named `receipts` for expense photo attachments (private, accessed via signed URLs).
6. Copy `.env.example` to `.env.local` in the project root and fill in:
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Project Settings → API → anon public key
