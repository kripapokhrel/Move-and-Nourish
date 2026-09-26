# Move & Nourish (MVP)

Personalized workouts and nutrition. Next.js 16 + Supabase + Tailwind.

## Setup (about 10 minutes)

1. `npm install`
2. Create a project at supabase.com
3. In Supabase, open **SQL Editor** and run each file in `supabase/migrations/` in order (0001, 0002, 0003, 0004)
4. For fast testing, turn off email confirmation — Authentication → Sign In / Providers → Email → uncheck "Confirm email". (If you leave it on, set Authentication → URL Configuration → Site URL to `http://localhost:3000`.)
5. `cp .env.example .env.local` and fill in the Supabase URL and publishable key (Project Settings → API Keys)
6. `npm run dev` → http://localhost:3000

`npm test` runs the nutrition and form unit tests.

## What works right now (Phase 1)

- Sign up, log in, log out
- 3-step onboarding, saved to Supabase
- BMI, BMR, TDEE, calorie and macro targets (deterministic, `lib/nutrition`)
- Profile page — edit anything, targets recalculate on save
- Dashboard with targets and placeholders for the next features
- Full database schema with RLS for every feature (workouts, meals, progress, weekly summaries)

## Where things live

- `lib/nutrition/config.ts` — every tunable number (deficits, protein g/kg, activity multipliers)
- `lib/profile/options.ts` — every dropdown/chip option, shared by UI, validation, and later AI prompts
- `lib/profile/service.ts` — the single "save profile + recalc" path
- `lib/db/*` — all Supabase queries. Pages never call `supabase.from()` directly.

See `docs/PLAN.md` for architecture, schema, flow, and build order.

## Data sources

- Exercise photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain)
- Recipe nutrition: [USDA FoodData Central](https://fdc.nal.usda.gov/) (public domain, CC0). Each recipe ingredient has
  a weight in grams and is mapped to a USDA food in `scripts/fdc/mapping.json`; `scripts/fdc/build_nutrients.py`
  turns the USDA bulk downloads into `lib/meals/nutrients.ts`. No API key is needed at runtime.

## Weekly Sunday email

Each Sunday, everyone with "Send me a weekly summary" on (Profile → Emails) gets their week: workouts vs goal,
meals cooked, weight trend, what the app has learned about them, and one idea for next week. Rule-based, no AI.
Each send is recorded in `weekly_summaries`, so a week is never sent twice.

1. **Gmail:** turn on 2-Step Verification for the Gmail account, create an app password at
   https://myaccount.google.com/apppasswords, then set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env.local`.
2. **Try it:** Profile → Emails → "Send me this week's summary now" emails you straight away.
3. **Schedule it** (once deployed): set `SUPABASE_SECRET_KEY` and `CRON_SECRET`, then call
   `GET /api/cron/weekly-summary` every Sunday with the header `Authorization: Bearer <CRON_SECRET>`.
   - Vercel: already set up in `vercel.json` (Sundays at 09:00 UTC). Vercel sends the header for you when
     `CRON_SECRET` is set in the project's environment variables.
   - Anywhere else: a GitHub Actions `schedule: - cron: "0 9 * * 0"` workflow that runs
     `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/weekly-summary`.
