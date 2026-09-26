# Move & Nourish plan

## Architecture

Browser → Next.js (App Router) → Supabase

- **Pages (app/)** stay thin — load data through `lib/db`, render components
- **Server Actions (lib/*/actions.ts)** handle every mutation. Validate with zod, then call a service
- **Services (lib/*/service.ts)** hold business logic, e.g. save profile → recalc nutrition
- **lib/db** is the only place that talks to Supabase tables
- **lib/nutrition** is pure math, no I/O, unit tested
- **lib/ai** (step 8+) wraps the Claude API. Server-only. Takes the profile from the DB, returns zod-validated JSON
- **lib/email** (step 12) is a provider interface. Resend first, swappable
- **proxy.ts** refreshes the Supabase session and sends logged-out users to /login
- **lib/personalization** learns from behaviour (see below). Pure logic plus one server-only service
- **RLS** on every table, so even a buggy query can't read another user's rows

AI does: workout plans, meal ideas, fridge recipes, weekly summary text.
App code does: auth, all math, all DB writes, progress stats, validation of AI output.

## Schema

| Table | Key | Notes |
|---|---|---|
| profiles | id → auth.users | all onboarding answers, metric units, arrays for lists |
| nutrition_profiles | user_id → profiles (1:1) | BMI, BMR, TDEE, targets, calculation_method |
| workout_plans | id, user_id | a week of workouts |
| workouts | id, plan_id (nullable) | one session. Standalone if plan_id is null |
| workout_exercises | id, workout_id | ordered by position, `completed` flag |
| workout_logs | id, workout_id (set null on delete) | completion history that survives regenerating |
| meal_history | id, user_id | every generated meal, source = fridge/recommend |
| saved_meals | user_id + meal_id unique | favourites |
| progress_logs | user_id + log_date unique | one row per day, measurements as jsonb |
| weekly_summaries | user_id + week_start unique | stats jsonb (app-computed) + AI text + email_status |
| user_events | id, user_id | raw behaviour: event_type, entity, small metadata jsonb (0004) |
| user_preferences | user_id + category + value unique | explicit likes/dislikes, e.g. "don't suggest Tuck jumps" |
| recommendation_feedback | user_id + target unique | optional ratings (too easy / just right / too hard, like / dislike + reasons) |
| user_behavior_summary | user_id | computed signals + inferences, recalculated from the three above |

## Personalization

Four layers, each rebuildable from the one before:

1. **Events** (`user_events`): what happened. Recorded by `track()` only when the user has personalization on, and never
   blocks the action it's attached to. Workouts: generated, refreshed, completed, skipped; exercises completed, skipped,
   replaced, removed, added. Meals: generated, viewed, saved, unsaved, ignored, logged (hook up in step 9).
2. **Signals** (`signals.ts`): counts with raw number, recency weight (30-day half-life) and last time. 90-day window.
3. **Inferences** (`infer.ts`): guesses, each with a confidence and plain-words evidence built from real counts. Need
   3+ events and confidence 0.5+. Explicit preferences (profile + `user_preferences`) always beat inferences.
4. **Nudges** (`apply.ts`): soft weights for the generators. Favourites 3× as likely, often-skipped 0.2×, preferred
   gear 2×, shorter cardio finisher, ± 1 set, session length blended toward what the user actually does. Learned
   nudges start after 3 finished workouts; explicit ones apply straight away. Each change adds a line to
   `workouts.personalized_because`, only when it actually changed the workout.

Stage 2 (AI): `buildPreferenceSummary()` gives a short labelled text profile (stated vs learned) to put in a prompt.
Not wired to any AI yet. All tunable numbers are in `lib/personalization/config.ts`.

Privacy: Profile → Personalization shows what's recorded and what was learned, has an on/off switch, lets the user
remove explicit preferences, and deletes all personalization data in one click. Notes and free text are never recorded.

## User flow

Sign up → onboarding (About you → Training → How you eat) → targets calculated → dashboard
Dashboard → generate workout / fridge / recommend meals / log progress
Profile → edit → targets recalculated → future generations use new profile
Sunday cron → compute stats per user → AI writes summary + focus → email

## Build order

1. ✅ Next.js setup
2. ✅ Supabase clients + proxy
3. ✅ Auth (email/password)
4. ✅ Schema + RLS (all tables)
5. ✅ Onboarding
6. ✅ Save onboarding to Supabase
7. ✅ Nutrition calculations + profile editing
8. ⏭ Workout generation (/workouts, complete/regenerate/save/history)
   - ✅ Today's workout: pick a focus (or "unsure"), generate, refresh. Rule-based and free: `lib/workouts/library.ts` + `generator.ts`. Needs `0002_workout_focus.sql`
   - ✅ Edit today's workout: swap (suggestions or type your own), add your own, remove, notes. Needs `0003_workout_user_notes.sql`
   - ✅ Tick exercises done, finish (with duration) or skip, optional ratings and favourites. Needs `0004_personalization.sql`
   - ✅ Personalization, stage 1 (rule-based). See "Personalization" above
   - ✅ Research-based differences for women (see comments in `generator.ts`): same exercises and sets, 20% shorter rests,
     and lower-body days always include a knee-supporting exercise (`knee` in the library). Exercises whose photos show a
     woman (`woman`, only 2 exist in free-exercise-db) are slightly preferred. Nothing changes by menstrual cycle
   - Next: workout history page
9. ✅ Meal generation
   - ✅ Recommend: pick breakfast/lunch/dinner/snack, get 3 ideas from `lib/meals/library.ts` (rule-based, free).
     Hard filters for diet, allergies and restrictions (`diet.ts`), ranked by fit to the meal's share of daily targets
     and learned taste (`rankMeals`). Save, "I made this", 👍/👎 with reasons. Dashboard "Recent meals" card.
     Needs `0005_meal_ideas.sql`
   - ✅ Each meal type has its own URL (`/meals?type=dinner`) and loads its latest ideas, making some if there are none
   - Profile: restrictions (allergies included) and cuisines are pick-lists (`RESTRICTIONS`, `CUISINES` in
     `lib/profile/options.ts`); old free-text answers are converted by `restrictionsFromText` when the form loads
   - ✅ Recipe nutrition comes from USDA FoodData Central: grams per ingredient × `lib/meals/nutrients.ts` (generated,
     see README "Data sources"). Optional extras aren't counted. Stand-ins for foods USDA doesn't list are labelled
   - ✅ What's in my fridge? (`/meals/fridge`, `lib/meals/fridge.ts`): recipes made ONLY from what the user listed
     (nothing assumed, not even oil). Up to 3 ideas. "Do you have …?" questions for ingredients that would complete
     recipes; Yes adds it, No is never asked again. Saved as `source = 'fridge'` with `{items, declined, mealType}`
     JSON in `source_input`
10. ✅ Progress (`/progress`): log weight, waist, water and a note per day (steps were dropped: most people can't count them) (up to 60 days back, one row per day in
    `progress_logs`). Stat tiles, weight chart with a 7-day average, workouts per week vs goal
    (`components/progress/Charts.tsx`, plain SVG with tooltips and table views). Logging a new weight offers to update
    the profile so targets are recalculated. Calories and protein "eaten today" come from meals marked "I made this"
11. ✅ Dashboard wired to real data (workouts this week, weight trend, recent meals)
12. ✅ Weekly Sunday email (`lib/weekly`, `app/api/cron/weekly-summary`): rule-based summary + "What we've learned"
    (moved out of the Profile page), sent with Gmail (`lib/email/send.ts`, swappable), recorded in `weekly_summaries`.
    Test button on Profile. Scheduling is ready but not switched on: see README "Weekly Sunday email"
