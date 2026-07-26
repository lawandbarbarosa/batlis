-- Extended signup onboarding: adds a "why are you learning" purpose, a weekly
-- day-commitment goal (alongside the existing daily_goal_minutes), and an
-- explicit completion marker so the app can tell "still mid-onboarding" apart
-- from "picked a language a while ago but the wizard didn't exist yet".
CREATE TYPE public.learning_purpose AS ENUM (
  'travel',
  'career',
  'study',
  'move_abroad',
  'connect',
  'fun'
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS learning_purpose public.learning_purpose;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_days_goal INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill: anyone who already picked a target language under the old
-- (single-step) onboarding has, in effect, already finished onboarding.
-- Without this, every existing user would get routed back into the new
-- multi-step wizard on their next login.
UPDATE public.profiles
SET onboarding_completed_at = now()
WHERE active_target_lang IS NOT NULL AND onboarding_completed_at IS NULL;
