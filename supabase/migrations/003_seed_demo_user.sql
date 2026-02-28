-- ─── DEV MODE ONLY — Demo user seed ──────────────────────────────────────────
-- DO NOT run in production.
-- Credentials:
--   Email:         demo@tracker.local
--   Password:      TrackerDemo2026
--   Decoy Code:    2468
--   Hint:          "It's the demo password for Daybook"
--
-- password_hash: PBKDF2(TrackerDemo2026, salt=demodevsal00000000000000, 200000, sha256)
-- For actual hash generation, run: npm run seed
-- This SQL is a placeholder; the real seed is in scripts/seed-demo-user.ts

-- Placeholder row (actual hash inserted by the seed script at runtime):
INSERT INTO public.users (id, email, password_hash, password_hint, decoy_code_hash, password_salt)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@tracker.local',
  'SEED_VIA_SCRIPT', -- replaced by scripts/seed-demo-user.ts
  'It''s the demo password for Daybook',
  'SEED_VIA_SCRIPT', -- replaced by scripts/seed-demo-user.ts
  'SEED_VIA_SCRIPT'  -- replaced by scripts/seed-demo-user.ts
)
ON CONFLICT (email) DO NOTHING;
