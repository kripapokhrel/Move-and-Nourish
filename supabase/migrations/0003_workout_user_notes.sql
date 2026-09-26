-- Editing a workout (step 8)
-- user_notes: what the user writes for the day. Kept when they refresh the workout.
alter table public.workouts add column if not exists user_notes text;
