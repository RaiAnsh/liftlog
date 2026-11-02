# LiftLog

A free workout tracker built around **muscle growth** that runs in your phone's browser, works offline, and keeps your data on your phone.
It replaces Strong: it imports your full Strong history, then adds a hypertrophy coach (next-session targets, goal-based weekly
volume, "do this next time" tips, program review, plateau detection).

- **No account, no backend, no cost.** Everything is stored on your device (IndexedDB).
- **Installs like an app** on iPhone via Safari → Add to Home Screen, and works in airplane mode.
- **Body-figure diagrams and how-to steps** for exercises (form photos on request), including a built-in library of common gym machines and cables.

> **Not included:** Apple Health sync and live machine data (gym machines and Safari web apps
> can't talk to each other). Your Strong history and everything you log here stays on the phone.

---

## Install on iPhone (for you or a friend)

1. Open the app's link in **Safari** (it must be Safari, not Chrome).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **LiftLog** from your Home Screen. After the first load it works offline.

## Coming from Strong? (optional)

1. In the Strong app: **Profile → Settings → Export Strong Data** (wording can vary by version). Strong emails or
   saves a `strong_workouts.csv` file. Put it somewhere your phone can open (Files, iCloud Drive, or email it to yourself).
2. In LiftLog: **Settings → Import from Strong**, choose the CSV.
3. Pick the unit your Strong weights were in (**lb or kg**; the file doesn't say), check the preview, and tap **Import**.
4. If a few exercises need muscle tags, open **Review muscle tags** and tap the muscles. Coaching counts sets per muscle, so this matters.

Importing the same file again is safe: it adds nothing twice.

**Templates:** Strong's export doesn't include your saved templates, but your history does name every workout. The first time you open
the Workout tab after importing, LiftLog offers one at a time to turn your usual workouts (done 3+ times in the past year, like "Push" or
"Pull") into templates, built from your most recent version of each. Say no and it never asks again. **Templates → Find templates in my history**
brings back anything you declined, plus older workouts.

## Using it

The tabs match Strong: **Profile · History · Workout · Exercises**.

| Tab | What it does |
| --- | --- |
| **Profile** | Weekly chart, "best right now / work on this / best lift", muscle map, records, stalled lifts, weekly review. Gear → Settings |
| **History** | Every workout (and skipped day 😢), searchable. "Start again" or "Save as template" from any of them |
| **Workout** | Start an empty workout, your "Up next" suggestion (with **Skip 😢**), your templates, and example templates (Push, Pull, Legs, Shoulders, Upper, Lower, Arms) |
| **Exercises** | The full library with body-figure diagrams, search, and a built-in library of common machines |

Tips:
- **Templates:** add an example (Push, Pull, Legs, Shoulders…) from the Workout tab, or open a past workout in History and choose **Save as template**.
- **Rotation:** Workout → Manage → mark templates **In rotation**. "Up next" then suggests the next one. **Skip 😢** logs a skipped day (with an optional reason), moves the rotation on, and can be undone in History.
- **Warm-ups & plates:** in a workout, tap an exercise's **⋯** → *Add warm-up sets* or *Plate calculator*.
- Your workout in progress is saved as you go. Close the app, lock the phone, reopen: it's all still there.

## Coaching rules (all explained in the app, none enforced)

- **Targets (double progression):** if every working set hit the top of the rep range at the same weight, add one weight step
  and go back to the bottom of the range. Otherwise keep the weight and add a rep to sets below the top.
  If average RPE was 9.5 or more, the weight stays.
- **Weekly muscle volume:** hard sets = completed working, drop and failure sets (not warm-ups). Primary muscle = 1 set, secondary = 0.5.
  Muscles show as *Not yet / Building / On track / High* (on track = 10–20 sets a week by default; tap a muscle to change it), compared with your own usual week.
- **Insights:** *Best right now* is the muscle you've worked hardest relative to its target; *Work on this* is the one longest untrained while under target; *Best lift* is the biggest estimated-1RM gain in the last 8 weeks.
- **Stalled lift:** no gain in top weight or estimated 1RM (Epley, sets of 12 reps or fewer) across the last 3 sessions.
- **Fatigue signal:** only with RPE data. The same weight × reps feels 1+ RPE harder than two weeks ago on 2 or more lifts.

## Can't find an exercise? Make it

The built-in library has 200+ exercises (barbell, dumbbell, machine, cable, Smith, bodyweight, and a **Cardio** tab with treadmill, bikes,
elliptical, stair climber, rowing and more). If your exercise still isn't there, tap **+ New** in the exercise picker or the Exercises tab, name it,
pick the equipment and tap the muscles it works (once for a main muscle, again for "also works"). It's saved to *your* data and counts toward weekly
volume, goal targets, coach tips and Push/Pull/Legs filing exactly like a built-in one. You can fix the muscles of any exercise later from its page.
Cardio exercises are logged as time and distance instead of weight and reps.

## Plan your week, phases and recommendations

- **Plan your week:** on the Workout tab, pick the days you're free and LiftLog suggests a split that fits **how many days you train and what you're building**:
  3 days is Push / Pull / Legs; 4 is Chest & Back / Legs / Shoulders & Arms / Upper (V-taper) or Upper / Lower twice (balanced); 5 adds a Shoulders & Arms and a
  Chest & Back day; 6 is PPL twice; 7 adds an easy Cardio & Core day. With a **Glutes & legs** goal you get glute-focused versions (Glutes & Hams, Quads & Glutes,
  Glute Pump & Abs, with upper days to balance). Templates you don't have are added; ones you already have with the same name are reused. Prefer your own?
  Switch to "My templates" and assign them yourself. "Up next" follows the plan, and a week strip shows what's done, skipped 😢 or coming up.
- **Phase:** tell it whether you're **Building**, **Maintaining** or **Cutting**. On a cut, the target is to *match last time* (holding your weights is the win),
  it stops suggesting extra sets, and flat lifts aren't flagged as stalled.
- **Volume style:** **Efficient** (about 2 hard sets per exercise), **Standard** or **High** set how many weekly sets each muscle aims for. LiftLog suggests Efficient
  if that's how you already train. 14–22 weekly sets is the maximise-growth end, not a requirement.
- **Recommended for you:** a couple of nudges, like easy cardio when you're cutting, a rest day after a long run of training days, or the workout that hits your
  most under-trained priority muscle.
- **% vs last time:** each exercise shows how today compares with your last session (a ▲, ▼ or 0%), live as you log and in History.
- **Top of my rep range** (Settings, or per exercise in a workout) controls where targets stop adding reps and raise the weight instead.

## Your goal and the hypertrophy coach

On first use LiftLog asks what you want to build: **Upper-body V-taper**, **Glutes & legs**, **Balanced**, or a custom per-muscle mix. That
sets how many hard sets each muscle should get per week (priority 14–22, standard 10–16, maintain 5–9; all editable).

- **In a workout** each exercise can show a 💡 tip for next time: add a set, trim a set, move to a heavier weight, rest longer when reps collapse,
  or split a big session. Every tip has a **Why?** link.
- **Profile → Coach** reviews your last few training weeks and flags muscles short of your goal, with one-tap fixes such as
  "Add 3 sets of Lateral Raise to Push" (it edits your template).
- **🔥 Momentum:** hit your targets three sets in a row and the screen erupts; five and eight in a row (and PRs) make it bigger.
- **The science** page lists the research behind each rule, what it found, and its limits. Summaries are the app author's, not medical advice.

## Your data and updates

Everything you log lives in your phone's browser storage (IndexedDB) for this site. **Updating the app never touches it**: updates replace
the code files only, the database is opened and (if needed) upgraded in place, and tests guard that path. What *can* lose data:

- **Deleting the app icon** (or clearing Safari website data) wipes its storage. So: **install to the Home Screen first, then import inside that app.**
  Storage in a Safari tab and in the installed app are separate, and Safari tabs can be cleared after a week of inactivity, while installed
  Home Screen apps are exempt from that rule.
- **Changing the site address** (e.g. renaming the GitHub repo) makes your phone look at a different place. Don't rename the repo.
- Phone storage being wiped. That's what **Export backup** is for. LiftLog also keeps three automatic restore points on the phone (daily, and
  before any restore) in a second database; those guard against app mistakes, not against the whole site's storage being cleared.

## Back up your data

Your data exists only on your phone, so use **Settings → Export backup** now and then (LiftLog reminds you every 14 days).
The share sheet lets you save it to Files / iCloud Drive. To move to a new phone, install the app there and use
**Restore from backup**. You can also export your workouts as a Strong-format CSV.

If you delete the app from your Home Screen or clear Safari website data, the data goes with it. That's what backups are for.

---

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, to try it on your phone)
npm test           # unit tests (importer, coaching, backup, ...)
npm run typecheck
npm run build      # static site in dist/
```

Stack: Vite, React, TypeScript, Tailwind, Dexie (IndexedDB), vite-plugin-pwa, PapaParse, Recharts, Vitest.
All coaching logic is pure functions in `src/coaching/`, covered by tests. No network calls anywhere.

### Private data

`sample-data/` is for your own real Strong exports during development. It is in `.gitignore` and a test fails if any file in it
is ever tracked by git. Committed tests use the small anonymised files in `src/__fixtures__/`. If `sample-data/strong_workouts.csv`
exists locally, one extra test imports it for real.

### Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) runs typecheck, tests and the build on every push, then publishes.
   The site is served at `https://<your-user>.github.io/<repo>/`. The base path is set automatically from the repo name.

Updating is just another push; installed copies pick up the new version the next time they're opened with a connection.

### Credits

Exercise photos and instructions come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain / Unlicense).
