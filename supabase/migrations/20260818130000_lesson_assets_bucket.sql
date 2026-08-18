-- ============ LESSON IMAGE/AUDIO ASSETS ============
-- admin.tsx and admin.functions.ts have been uploading lesson pictures
-- (uploaded files, AI illustrations, and imported stock photos) to a
-- "lesson-assets" bucket, and reading them back with getPublicUrl(). That
-- bucket was never actually created by a migration — unlike course-covers,
-- video-banners, book-covers, book-images and book-audio, which all have
-- one. Without it, either the upload itself fails, or (if someone created
-- the bucket by hand in the dashboard without marking it public) the
-- resulting "public" URL 404s — so the picture never renders on the
-- learner-facing lesson page even though it looked saved in admin.
--
-- ON CONFLICT ... DO UPDATE SET public = true also repairs the bucket if it
-- already exists but wasn't marked public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-assets', 'lesson-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read lesson assets" ON storage.objects;
CREATE POLICY "public read lesson assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-assets');

DROP POLICY IF EXISTS "admin write lesson assets" ON storage.objects;
CREATE POLICY "admin write lesson assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin update lesson assets" ON storage.objects;
CREATE POLICY "admin update lesson assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin delete lesson assets" ON storage.objects;
CREATE POLICY "admin delete lesson assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-assets' AND public.has_role(auth.uid(), 'admin'));
