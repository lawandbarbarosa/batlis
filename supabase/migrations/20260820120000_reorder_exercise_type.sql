-- Adds "reorder" (the sentence-builder exercise, where a learner taps a
-- shuffled sentence's own words back into the correct order) to the
-- exercise_type enum, alongside the existing multiple_choice / fill_blank /
-- listening / translate types. ALTER TYPE ... ADD VALUE can't run inside the
-- same transaction as a statement that uses the new value, but this file
-- only adds the value — nothing here queries lesson_exercises — so it's
-- safe as its own migration.
ALTER TYPE public.exercise_type ADD VALUE IF NOT EXISTS 'reorder';
