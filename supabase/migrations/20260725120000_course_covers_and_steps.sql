-- ============ COURSE COVER IMAGES ============
-- Cover image shown on the course card on the /learn/:lang browsing page.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cover_image_path TEXT;

-- Public bucket for course cover images, mirroring the video-banners setup.
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-covers', 'course-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read course covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-covers');

CREATE POLICY "admin write course covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update course covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete course covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-covers' AND public.has_role(auth.uid(), 'admin'));

-- ============ STEP-BY-STEP LESSON CONTENT ============
-- An ordered list of typed steps a learner walks through before the quiz:
--   { "type": "word",     "target": "apple", "kurdish_sorani": "سێو", "kurdish_badini": "سێف", "audio_url": null }
--   { "type": "sentence", "target": "I eat an apple every day.", "kurdish_sorani": "...", "kurdish_badini": "...", "audio_url": null }
--   { "type": "image",    "url": "https://...", "caption": "optional" }
--   { "type": "tip",      "text": "optional note, e.g. a grammar aside" }
-- "target" is read aloud (via stored audio_url if set, otherwise the
-- browser's built-in text-to-speech using the course's language).
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS steps_json JSONB NOT NULL DEFAULT '[]'::jsonb;
