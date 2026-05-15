-- ─── Stop leaking DV nature of accounts in cleartext ─────────────────────────
-- vault_contacts.relationship was stored as cleartext for display ordering and
-- held values like "DV Advocate", "Shelter Staff", "Guardian ad Litem". A DB
-- breach (or a curious service-role insider) immediately revealed the DV/legal
-- nature of the account — which is what the encryption design is meant to
-- prevent. Relationship is now encrypted inside the per-row payload instead.
--
-- This migration scrubs any existing cleartext labels. Run it BEFORE deploying
-- the matching app code, or existing rows will keep leaking until re-saved.

UPDATE public.vault_contacts SET relationship = '' WHERE relationship <> '';
