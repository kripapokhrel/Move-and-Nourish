-- Workout generation (step 8)
-- focus: what the user asked to train ("upper_body", "unsure", ...). Refresh reuses it.
-- notes: the AI's one-line explanation of the session.
alter table public.workouts add column if not exists focus text;
alter table public.workouts add column if not exists notes text;
