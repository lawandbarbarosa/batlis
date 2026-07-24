-- ============ BOOK PAGE UPLOADS (for AI-assisted reading) ============
-- Admins upload photos/scans of a book's pages here; a server function then
-- sends them to the AI to transcribe into paragraphs. Private: only admins
-- ever need to read these, nothing here is shown to learners.
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-pages', 'book-pages', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin read book pages bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-pages' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write book pages bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-pages' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update book pages bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-pages' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete book pages bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-pages' AND public.has_role(auth.uid(), 'admin'));

-- ============ BOOK INLINE IMAGES ============
-- Images an admin places anywhere inside a book's content (illustrations,
-- diagrams, photos of the original page, etc). Public: learners load these
-- directly while reading, same as book covers and video banners.
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-images', 'book-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read book images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-images');

CREATE POLICY "admin write book images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update book images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete book images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-images' AND public.has_role(auth.uid(), 'admin'));
