-- ─── Storage bucket for encrypted media ──────────────────────────────────────
-- Run this in the Supabase SQL editor OR via the CLI after creating the bucket.
-- The bucket must be created via the Supabase dashboard (Storage > New bucket)
-- with name "vault-media" and "Private" (not public).
-- RLS on the bucket: only authenticated via service role (server-side) can access.

-- Supabase Storage bucket policies (run after bucket creation):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('vault-media', 'vault-media', FALSE)
-- ON CONFLICT (id) DO NOTHING;

-- Allow no public access; server uses service role for signed URL generation.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-media',
  'vault-media',
  FALSE,
  104857600, -- 100 MB per file
  ARRAY['image/jpeg','image/png','image/heic','image/heif','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: deny all anon access; service role bypasses RLS
CREATE POLICY "No anon access vault-media"
  ON storage.objects FOR ALL TO anon
  USING (FALSE);
