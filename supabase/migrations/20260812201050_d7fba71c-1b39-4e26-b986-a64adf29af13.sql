ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS cover_image_path text,
  ADD COLUMN IF NOT EXISTS source_json jsonb;