# CLAUDE.md — Meals & Training (personal app)

## What this is
A personal mobile app for one user (me). It manages meals (macro tracking + weekly meal plan) and my existing training program. The goal is to make adherence effortless to log and easy to see.
Not a product for others: no auth, no onboarding, no multi-user support.

## Language & layout
- UI: Arabic only, full RTL (`I18nManager.forceRTL(true)`). Western digits (0–9) for numbers.
- Font: IBM Plex Sans Arabic (`@expo-google-fonts/ibm-plex-sans-arabic`).
- Code, comments, commit messages: English.

## Stack
- Expo (latest SDK) + TypeScript + Expo Router.
- Local-first: `expo-sqlite` + Drizzle ORM. All data on-device; the app works fully offline.
- UI state: Zustand. The database is the source of truth.
- Motion: `react-native-reanimated` (springs), `react-native-gesture-handler`, `expo-haptics`.
- Charts: `react-native-svg`, drawn by hand. Keep it light.
  (Not `victory-native`: it needs `@shopify/react-native-skia`, which Expo Go
  does not bundle, and Expo Go is the device test loop. The charts here —
  monthly heatmap, weight trend, macro rings — are simple enough to draw
  directly.)
- Notifications: `expo-notifications` (local only). Calendar: `expo-calendar` (Phase 4).
- Phase 5 only: Supabase for backup + an Edge Function that proxies the Claude API for food estimation. Never ship API keys inside the app.

## Core principle: the plan IS the log
Adherence dies when logging is tedious. Every planned meal and set defaults to "as planned".
I confirm with one tap and edit only when reality differed.
Any flow that needs more than 2 taps to log a normal day is a bug.

## Data model (initial)
- `targets`: day_type (training | rest | busy), kcal, protein_g, carbs_g, fat_g
- `foods`: id, name_ar, serving_label, kcal, protein_g, carbs_g, fat_g (per serving)
- `meals` (library): id, name_ar, items[] → (food_id, servings)
- `day_templates`: id, name_ar, day_type, slots[] → meal_id
- `week_plan`: date → day_template_id (+ per-day overrides)
- `meal_logs`: date, slot, meal_id, status (planned | confirmed | changed | skipped), actual_items if changed
- `program_days`: id, name (e.g. Push / Pull / Legs), order
- `exercises`: id, program_day_id, name, sets, rep_min, rep_max, rest_sec, notes
- `program_schedule`: weekday → program_day_id | rest
- `workout_sessions`: id, date, program_day_id, status, started_at, finished_at
- `set_logs`: session_id, exercise_id, set_no, weight_kg, reps, done
- `body_weight`: date, kg
- `weekly_reviews`: week_start, missed_reasons[] (travel | work | no_food | tired | other), note

## Screens
1. **اليوم (Home)** — answers only two questions: what's left to eat today (kcal + protein rings) and today's workout. Meal cards with one-tap confirm. "يوم مشغول" toggle.
2. **الوجبات** — tabs: today's log / weekly plan / shopping list / meal library.
3. **التمارين** — today's session. Each exercise shows last session's weight × reps. Tap a set to mark it done. Rest timer. Suggest a weight increase when all sets hit rep_max.
4. **التقدم** — monthly adherence heatmap, streak, 7-day average weight trend, PRs.
5. **الإعدادات** — targets per day type, program editor, reminder times, JSON export/import.

## Adherence score (daily, 0–100)
- 40 pts: calories within ±10% of the day-type target
- 30 pts: protein ≥ 90% of target
- 30 pts: planned workout completed (rest day = automatic 30)
- Busy mode swaps in the busy targets/template; the day still scores.
- Every Thursday evening: weekly review screen showing misses; I tag reasons with one tap each.

## Scheduling
- 2–3 day templates rotate instead of 7 unique days.
- Shopping list = aggregated items from the week plan.
- Meal-prep view: which meals to batch-cook for the week.
- Local reminders: workout time, meal times, Thursday night "plan next week".

## Design rules
- Dark mode by default; light mode supported.
- Large numbers, generous spacing, one primary action per screen.
- Feedback on press-in, never on release. No artificial delays.
- Springs via Reanimated `withSpring`: critically damped by default; bounce only after a flick/drag release.
- Haptics: light on set/meal confirm, success on workout finish or PR.
- Celebrate only a PR or a perfect week. No decorative animation elsewhere.
- Respect reduce-motion.
- Motion principles: `.claude/skills/apple-design` (written for web — translate to Reanimated).

## Build phases — finish and test on device before moving on
1. Program + workout session logging (seeded with my real program)
2. Foods, meal library, daily macro log, targets
3. Day templates, weekly plan, shopping list, busy mode
4. Adherence score, progress screen, reminders, weekly review, calendar
5. Supabase backup + natural-language food logging via Claude API

## Working rules
- Start every phase by presenting a plan; wait for my approval before coding.
- Small commits after each working feature.
- Seed with my real program and meals. Never fake data.
- I test on my phone with Expo Go after each feature.
- Nothing outside the current phase. Park ideas in `docs/ideas.md`.
- Keep dependencies minimal; ask before adding a new library.
