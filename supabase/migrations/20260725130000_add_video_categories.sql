-- Add video categories (podcast, animation, movie, show, talking, etc.) so an
-- admin can classify each video from Admin > Videos, and the public Videos page
-- can show/filter by category. Nullable so existing videos aren't forced into
-- a category — they'll just show up as "Uncategorized" until an admin sets one.
CREATE TYPE public.video_category AS ENUM (
  'podcast',
  'animation',
  'movie',
  'show',
  'talking',
  'music',
  'documentary',
  'news',
  'other'
);

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS category public.video_category;

-- Speeds up "browse by category" queries on the videos page.
CREATE INDEX IF NOT EXISTS videos_category_idx ON public.videos (category);

-- To add more categories later (the enum can't be edited in this file once
-- applied), run a follow-up migration like:
--   ALTER TYPE public.video_category ADD VALUE 'interview';
