-- Move & Nourish MVP schema
-- Run in Supabase SQL editor, or `supabase db push` if using the CLI.
-- Units are stored metric (cm, kg, ml). The UI converts.

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  name                   text,
  age                    int  check (age between 13 and 100),
  sex                    text check (sex in ('male', 'female', 'other')),
  height_cm              numeric(5,1) check (height_cm between 100 and 250),
  weight_kg              numeric(5,1) check (weight_kg between 30 and 350),
  fitness_level          text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  fitness_goal           text check (fitness_goal in ('lose_fat', 'build_muscle', 'maintain', 'improve_fitness')),
  workout_location       text check (workout_location in ('home', 'gym', 'both')),
  available_equipment    text[] not null default '{}',
  equipment_other        text,
  workout_days_per_week  int  check (workout_days_per_week between 2 and 7),
  session_duration_min   int  not null default 45 check (session_duration_min between 10 and 180),
  dietary_type           text check (dietary_type in ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other')),
  dietary_restrictions   text[] not null default '{}',
  allergies              text[] not null default '{}',
  disliked_foods         text[] not null default '{}',
  preferred_cuisines     text[] not null default '{}',
  unit_system            text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  weekly_email_opt_in    boolean not null default true,
  onboarding_completed   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- nutrition_profiles (1:1, derived from profiles by app code) ----------
create table public.nutrition_profiles (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  bmi                  numeric(4,1) not null,
  bmr                  int not null,
  activity_multiplier  numeric(4,3) not null,
  tdee                 int not null,
  calorie_target       int not null,
  protein_target_g     int not null,
  carb_target_g        int not null,
  fat_target_g         int not null,
  calculation_method   text not null,
  updated_at           timestamptz not null default now()
);
create trigger nutrition_profiles_updated_at before update on public.nutrition_profiles
  for each row execute function public.set_updated_at();

-- ---------- workouts ----------
-- A plan groups a week of workouts. A workout can also exist on its own (plan_id null).
create table public.workout_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  goal            text,
  fitness_level   text,
  days_per_week   int,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on public.workout_plans (user_id, created_at desc);

create table public.workouts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  plan_id         uuid references public.workout_plans(id) on delete cascade,
  name            text not null,              -- e.g. "Lower Body"
  day_of_week     smallint check (day_of_week between 0 and 6), -- 0 = Monday, null if standalone
  scheduled_date  date,
  goal            text,
  fitness_level   text,
  duration_min    int,
  is_saved        boolean not null default false,
  status          text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.workouts (user_id, created_at desc);
create index on public.workouts (plan_id);

create table public.workout_exercises (
  id              uuid primary key default gen_random_uuid(),
  workout_id      uuid not null references public.workouts(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade, -- denormalized for simple RLS
  position        int not null default 0,
  exercise_name   text not null,
  muscle_group    text,
  sets            int,
  reps            text,                      -- text so "8 each leg" or "30 sec" works
  rest_seconds    int,
  instructions    text,
  completed       boolean not null default false
);
create index on public.workout_exercises (workout_id, position);

-- One row per completed session (history survives regenerating/deleting a workout)
create table public.workout_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  workout_id           uuid references public.workouts(id) on delete set null,
  workout_name         text not null,
  completed_at         timestamptz not null default now(),
  duration_min         int,
  exercises_completed  int not null default 0,
  exercises_total      int not null default 0,
  notes                text
);
create index on public.workout_logs (user_id, completed_at desc);

-- ---------- meals ----------
create table public.meal_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  meal_name       text not null,
  ingredients     jsonb not null default '[]', -- [{ "item": "tofu", "quantity": "150 g" }]
  instructions    text[] not null default '{}',
  calories        int,
  protein_g       int,
  carbs_g         int,
  fat_g           int,
  prep_time_min   int,
  meal_type       text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'post_workout', 'any')),
  cuisine         text,
  source          text not null check (source in ('fridge', 'recommend', 'manual')),
  source_input    text,                         -- the fridge list or request prompt
  created_at      timestamptz not null default now()
);
create index on public.meal_history (user_id, created_at desc);

create table public.saved_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  meal_id     uuid not null references public.meal_history(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, meal_id)
);

-- ---------- progress ----------
create table public.progress_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  log_date            date not null default current_date,
  weight_kg           numeric(5,1),
  calories            int,
  protein_g           int,
  workouts_completed  int,
  steps               int,
  water_ml            int,
  measurements        jsonb,                -- { "waist_cm": 80, "hips_cm": 95 }
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, log_date)
);
create trigger progress_logs_updated_at before update on public.progress_logs
  for each row execute function public.set_updated_at();

-- ---------- weekly summaries (email pipeline) ----------
create table public.weekly_summaries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  week_start       date not null,           -- Monday
  stats            jsonb not null,          -- computed by app code, not AI
  ai_summary       text,
  suggested_focus  text,
  email_status     text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------- Row Level Security ----------
alter table public.profiles           enable row level security;
alter table public.nutrition_profiles enable row level security;
alter table public.workout_plans      enable row level security;
alter table public.workouts           enable row level security;
alter table public.workout_exercises  enable row level security;
alter table public.workout_logs       enable row level security;
alter table public.meal_history       enable row level security;
alter table public.saved_meals        enable row level security;
alter table public.progress_logs      enable row level security;
alter table public.weekly_summaries   enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Same "own rows" policy for every user_id table
do $$
declare t text;
begin
  foreach t in array array[
    'nutrition_profiles', 'workout_plans', 'workouts', 'workout_exercises',
    'workout_logs', 'meal_history', 'saved_meals', 'progress_logs'
  ] loop
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Weekly summaries are written by the server (service role), users can only read theirs
create policy "read own summaries" on public.weekly_summaries
  for select using (auth.uid() = user_id);
