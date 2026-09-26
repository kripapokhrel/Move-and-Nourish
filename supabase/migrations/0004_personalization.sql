-- Personalization: learn from what each user actually does.
-- Raw events, explicit preferences, feedback and the computed summary live in separate tables,
-- so the summary can always be thrown away and recalculated from the raw data with better rules.

-- The user's switch. Off = nothing new is recorded and recommendations ignore past behaviour.
alter table public.profiles add column if not exists personalization_enabled boolean not null default true;

-- Why a generated workout looks the way it does ("Includes goblet squats because you often finish them").
alter table public.workouts add column if not exists personalized_because text[];

-- ---------- user_events: one row per thing the user did ----------
create table if not exists public.user_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  event_type   text not null check (event_type ~ '^[a-z_]{3,40}$'),  -- workout_completed, exercise_skipped, meal_saved ...
  entity_type  text check (entity_type in ('workout', 'exercise', 'meal')),
  entity_id    text,                                                -- workout id, exercise name, meal id
  metadata     jsonb not null default '{}',                         -- small facts used for aggregation (focus, gear, cuisine ...)
  created_at   timestamptz not null default now()
);
create index if not exists user_events_user_time on public.user_events (user_id, created_at desc);

-- ---------- user_preferences: things the user told us directly ----------
create table if not exists public.user_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    text not null check (category in ('exercise', 'ingredient', 'cuisine', 'meal_type', 'workout_focus')),
  value       text not null,
  sentiment   text not null check (sentiment in ('like', 'dislike')),
  created_at  timestamptz not null default now(),
  unique (user_id, category, value)
);

-- ---------- recommendation_feedback: optional ratings. Changing a rating replaces it ----------
create table if not exists public.recommendation_feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('workout', 'exercise', 'meal')),
  target_id    text not null,        -- workout id, "<workout id>:<exercise name>", meal id
  rating       text not null check (rating in ('too_easy', 'just_right', 'too_hard', 'like', 'dislike')),
  reasons      text[] not null default '{}',
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index if not exists recommendation_feedback_user_time on public.recommendation_feedback (user_id, updated_at desc);
drop trigger if exists recommendation_feedback_updated_at on public.recommendation_feedback;
create trigger recommendation_feedback_updated_at before update on public.recommendation_feedback
  for each row execute function public.set_updated_at();

-- ---------- user_behavior_summary: computed by app code from the three tables above ----------
create table if not exists public.user_behavior_summary (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  signals      jsonb not null,        -- counts with timestamps (what happened)
  inferences   jsonb not null,        -- what we think it means, each with a confidence and its evidence
  event_count  int not null default 0,
  version      int not null default 1, -- bump when the aggregation rules change
  computed_at  timestamptz not null default now()
);

-- ---------- Row Level Security: every user sees only their own rows ----------
alter table public.user_events             enable row level security;
alter table public.user_preferences        enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.user_behavior_summary   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['user_events', 'user_preferences', 'recommendation_feedback', 'user_behavior_summary'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
