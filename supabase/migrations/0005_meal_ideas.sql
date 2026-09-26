-- Meal ideas (step 9)
-- library_id: which recipe in lib/meals/library.ts the idea came from
-- batch_id: ideas generated together share one id, so the page can show the latest set
-- made_at: last time the user said "I made this"
-- fits_targets: whether it matched their calorie and protein target for that meal
-- personalized_because: why it was recommended ("you often save Indian meals")
alter table public.meal_history add column if not exists library_id text;
alter table public.meal_history add column if not exists batch_id uuid;
alter table public.meal_history add column if not exists made_at timestamptz;
alter table public.meal_history add column if not exists fits_targets boolean;
alter table public.meal_history add column if not exists personalized_because text[];
create index if not exists meal_history_user_batch on public.meal_history (user_id, batch_id);
