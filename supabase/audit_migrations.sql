-- ════════════════════════════════════════════════════════════════════════════
-- BelleMeadow — MIGRATION AUDIT  (read-only for your data — see note below)
-- ────────────────────────────────────────────────────────────────────────────
-- Paste this whole script into the Supabase SQL editor and Run. It returns one
-- row per migration telling you whether that migration has already been applied,
-- by checking for the schema object (or data) the migration creates. Use it to
-- decide what still needs to be run — instead of blindly re-running everything.
--
--   ✅ yes  = applied (skip it)
--   ❌ NO   = not applied (run that migration file)
--   —       = can't tell yet (a prerequisite migration is missing)
--
-- It does NOT touch, modify, or delete any of your data. The only thing it
-- creates is a TEMPORARY helper function in your session's pg_temp schema, which
-- Postgres drops automatically when the session ends. Safe to run on production.
--
-- NOTE on 003: for PRODUCTION you WANT it to read "❌ NO". A "✅ yes" there means
-- the demo/public-credential user exists in your prod DB and should be removed.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: run a read-only probe that may reference a table which doesn't exist
-- yet. Returns the boolean result, or NULL if the table/column is missing (so a
-- not-yet-migrated DB reports cleanly instead of erroring out).
CREATE OR REPLACE FUNCTION pg_temp.probe(p_sql text) RETURNS boolean
LANGUAGE plpgsql AS $fn$
DECLARE result boolean;
BEGIN
  EXECUTE p_sql INTO result;
  RETURN result;
EXCEPTION
  WHEN undefined_table OR undefined_column OR undefined_function THEN RETURN NULL;
END
$fn$;

WITH checks AS (
  SELECT '001_initial_schema' AS migration,
         to_regclass('public.users') IS NOT NULL AS applied,
         'public.users table exists' AS detail
  UNION ALL
  SELECT '002_storage_bucket',
         COALESCE(pg_temp.probe(
           $q$SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vault-media' AND public = false)$q$
         ), false),
         'vault-media storage bucket exists and is PRIVATE'
  UNION ALL
  SELECT '003_seed_demo_user [DEV ONLY]',
         COALESCE(pg_temp.probe(
           $q$SELECT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo@tracker.local')$q$
         ), false),
         'demo user present — in PRODUCTION this MUST be ❌ NO'
  UNION ALL
  SELECT '004_vault_contacts',
         to_regclass('public.vault_contacts') IS NOT NULL,
         'public.vault_contacts table exists'
  UNION ALL
  SELECT '005_email_verified',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users'
                   AND column_name = 'email_verified_at'),
         'users.email_verified_at column exists'
  UNION ALL
  SELECT '006_rate_limits',
         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_rate_limit'),
         'increment_rate_limit() function exists'
  UNION ALL
  SELECT '007_encrypt_contact_relationship',
         pg_temp.probe(
           $q$SELECT count(*) = 0 FROM public.vault_contacts WHERE relationship <> ''$q$
         ),
         'no cleartext relationship labels remain (data scrub applied)'
  UNION ALL
  SELECT '008_persistent_lockout',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users'
                   AND column_name = 'failed_attempts')
         AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users'
                   AND column_name = 'locked_until'),
         'users.failed_attempts + locked_until columns exist'
  UNION ALL
  SELECT '009_restrict_rate_limit_rpc',
         CASE
           WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_rate_limit') THEN NULL
           ELSE NOT has_function_privilege(
                  'anon',
                  (SELECT oid FROM pg_proc WHERE proname = 'increment_rate_limit' LIMIT 1),
                  'EXECUTE')
         END,
         'anon role can NO LONGER execute the rate-limit RPC'
  UNION ALL
  SELECT '010_recovery_codes',
         to_regclass('public.recovery_codes') IS NOT NULL,
         'public.recovery_codes table exists'
  UNION ALL
  SELECT '011_login_events',
         to_regclass('public.login_events') IS NOT NULL,
         'public.login_events table exists'
)
SELECT migration,
       CASE WHEN applied IS NULL THEN '—'
            WHEN applied THEN '✅ yes'
            ELSE '❌ NO' END AS applied,
       detail
FROM checks
ORDER BY migration;

-- ── Bonus: if these migrations were applied via the Supabase CLI (not the SQL
-- editor), the CLI keeps its own ledger. This will be empty if you pasted them
-- by hand — that's expected; rely on the audit above in that case.
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
