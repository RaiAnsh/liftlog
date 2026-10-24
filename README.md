# LiftLog

A free workout tracker that runs in your phone's browser, works offline, and keeps your data on your phone.
It replaces Strong: it imports your full Strong history, then adds coaching (next-session targets, weekly
muscle volume, skip warnings, plateau detection).

- **No account, no backend, no cost.** Everything is stored on your device (IndexedDB).
- **Installs like an app** on iPhone via Safari → Add to Home Screen, and works in airplane mode.
- **Photos and how-to steps** for exercises, including a library of Planet Fitness machines.

> **Not included:** Apple Health sync and live machine data (Planet Fitness machines and Safari web apps
> can't talk to each other). Your Strong history and everything you log here stays on the phone.

---

## Install on iPhone (for you or a friend)

1. Open the app's link in **Safari** (it must be Safari, not Chrome).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **LiftLog** from your Home Screen. After the first load it works offline.

## Bring your history over from Strong

1. In the Strong app: **Profile → Settings → Export Strong Data** (wording can vary by version). Strong emails or
   saves a `strong_workouts.csv` file. Put it somewhere your phone can open (Files, iCloud Drive, or email it to yourself).
2. In LiftLog: **Settings → Import from Strong**, choose the CSV.
3. Pick the unit your Strong weights were in (**lb or kg**; the file doesn't say), check the preview, and tap **Import**.
4. If a few exercises need muscle tags, open **Review muscle tags** and tap the muscles. Coaching counts sets per muscle, so this matters.

Importing the same file again is safe: it adds nothing twice.

## Using it

| Tab | What it does |
| --- | --- |
| **Home** | "Up next" workout, warnings (behind this week, untrained muscles), stalled lifts, weekly review |
| **Workout** | Start empty or from a routine. Targets show for every exercise. Rest timer starts when you tick a set |
| **History** | Every workout, searchable. "Start again" or "Save as routine" from any of them |
| **Progress** | Weekly muscle volume, records, exercise charts, plate calculator |
| **Settings** | Units, bar & plates, week start, backup/restore, import |

Tips:
- **Routines:** the quickest way to start is History → open a past workout → **Save as routine**.
- **Rotation:** Workout → Manage → mark routines **In rotation**. Home then suggests the next one.
- **Warm-ups & plates:** in a workout, tap an exercise's **⋯** → *Add warm-up sets* or *Plate calculator*.
- Your workout in progress is saved as you go. Close the app, lock the phone, reopen: it's all still there.

## Coaching rules (all explained in the app, none enforced)

- **Targets (double progression):** if every working set hit the top of the rep range at the same weight, add one weight step
  and go back to the bottom of the range. Otherwise keep the weight and add a rep to sets below the top.
  If average RPE was 9.5 or more, the weight stays.
- **Weekly volume:** hard sets = completed working, drop and failure sets (not warm-ups). Primary muscle = 1 set, secondary = 0.5.
  Default range is 10–20 sets per muscle per week; tap any muscle to change it.
- **Stalled lift:** no gain in top weight or estimated 1RM (Epley, sets of 12 reps or fewer) across the last 3 sessions.
- **Fatigue signal:** only with RPE data. The same weight × reps feels 1+ RPE harder than two weeks ago on 2 or more lifts.

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
