-- ============ BOOK READ-ALOUD AUDIO ============
-- Generated once per paragraph (ElevenLabs text-to-speech with word-level
-- timestamps), then cached forever and reused by every reader. The audio
-- file lives here; the matching word timings are stored back onto the
-- paragraph itself in books.content_json (audio_path, audio_word_timings,
-- audio_text_hash — see bookParagraphSchema in admin.functions.ts).
--
-- Public: learners' browsers stream this file directly while reading, same
-- as book covers/images. Writes only ever happen from trusted server code
-- (the getBookReadAloudAudio server function, using the service-role
-- client) — regular authenticated users never write here directly, so the
-- INSERT/UPDATE/DELETE policies below are admin-only, matching every other
-- book-asset bucket. That's a defense-in-depth default, not the primary
-- write path.
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-audio', 'book-audio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read book audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-audio');

CREATE POLICY "admin write book audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-audio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update book audio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-audio' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete book audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-audio' AND public.has_role(auth.uid(), 'admin'));
