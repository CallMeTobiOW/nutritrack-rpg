# NutriTrack RPG

A personal nutrition and fitness tracker for iPhone, built as an installable web app (PWA)
with an original dark fantasy / sci-fi HUD style. Log food, scan barcodes, track macros,
vitamins, minerals, water and weight, and earn XP by completing healthy-habit quests.

Everything is free: no Mac, no App Store, no Apple Developer membership, no paid APIs.
All personal data stays on the device.

## Guides

| Guide | For |
|---|---|
| [docs/HOSTING-AND-INSTALL.md](docs/HOSTING-AND-INSTALL.md) | Publishing the app (GitHub Pages) and installing it on iPhone |
| [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md) | Setting up a Windows PC to edit, test and publish the app |
| [PROGRESS.md](PROGRESS.md) | Build status and what has and hasn't been verified |

## Features

- **Home dashboard:** level and XP, calories ring with macro bars, today's missions, water quick-add, today's briefing and the next achievements.
- **Daily briefing:** 120 original motivational messages from four characters, one per day with an intro animation, an "Another briefing" button and no repeats until all have been seen.
- **Food diary:** breakfast, lunch, dinner and snacks; search, recents, favourites, custom foods, saved meals, copy a meal from yesterday, edit portions in servings, g or ml.
- **Barcode scanner:** EAN-13, EAN-8, UPC-A and UPC-E via the iPhone camera (ZXing), with typed entry as a fallback, looked up on Open Food Facts. Nutrition values are never invented: missing data is shown as unknown.
- **Nutrition:** protein, carbs, fat, fibre, sugar and saturated fat against targets, 13 vitamins and 11 minerals against adult reference intakes, and trends over 7 days, 30 days or 12 weeks.
- **Water:** quick-add 150 / 250 / 350 / 500 / 750 ml or a custom amount, edit entries, daily goal and history.
- **Weight:** kg or lbs, goal weight, history, weekly averages and a trend chart with a 7-day average.
- **Profile and targets:** Mifflin-St Jeor calorie estimate with a safe deficit for weight loss and a calorie floor; every target can be overridden.
- **Quests:** daily missions, side quests, weekly objectives and one-time challenges; custom quests; auto-tracked quests (water, protein, meals, calorie range, fibre, weigh-in); history.
- **Progression:** XP, levels, ranks and 23 achievements. XP never rewards unhealthy behaviour (under-eating doesn't count), missed days never cost XP, and the XP ledger can't award the same reward twice.
- **Statistics:** averages, calories, mission completion, XP over time, weekly consistency and weight trend for 7, 30, 90 days or all time.
- **Data:** stored in IndexedDB on the device, works offline, JSON backup and restore, delete-all, and a plain-language privacy explanation.
- **Look and feel:** dark mode by default plus light and system themes, optional synthesised sound effects, iPhone safe areas, launch screens and home-screen icon.

## Privacy

There is no account, server, analytics or tracking. The only network requests are to
**Open Food Facts**, and they contain only the barcode or search words (plus the IP address and
browser type that any web request includes). Product photos load from Open Food Facts' image
server. Camera video is processed on the phone and never saved or uploaded.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Dexie (IndexedDB) · @zxing/browser ·
Open Food Facts API · Recharts · Lucide icons · vite-plugin-pwa (Workbox) · Vitest.
Fonts: Inter and Rajdhani (bundled, no Google requests).

## Commands

```bash
npm install         # once, downloads dependencies
npm run dev         # development server at http://localhost:5173
npm test            # unit and database tests (Vitest)
npm run typecheck   # TypeScript check
npm run lint        # Oxlint
npm run build       # production build into dist/
npm run preview     # serve the production build (tests offline/PWA behaviour)
```

Optional asset scripts (need Playwright installed globally; only if the artwork changes):
`node scripts/generate-icons.mjs` and `node scripts/generate-splash.mjs`.

## Project structure

```
src/
  lib/          Pure logic: dates, nutrients, targets, XP, quests, streaks, achievements,
                stats, Open Food Facts client, briefing picker (unit tested)
  db/           Dexie database, defaults, actions, progression engine, backup/restore
  data/         The 120 original briefings
  hooks/        Live database queries for components
  components/   UI kit (ui/), game pieces (game/), charts, layout (nav, splash, toasts)
  features/     One folder per screen: home, food, nutrition, water, weight, quests,
                profile, stats, settings, onboarding, briefing
  styles/       Theme tokens (dark and light) and HUD utilities
public/         Icons and iOS launch screens
scripts/        Asset generators and helper scripts
docs/           Setup, hosting and install guides
.github/        GitHub Pages deploy workflow
```

### Design notes

- **Nutrients** are stored per 100 g/ml. A missing key means "unknown", never zero; totals
  record how many logged items reported each nutrient.
- **Diary entries** keep a snapshot of the food, so editing a food later doesn't rewrite history.
- **XP ledger:** every reward has a deterministic id (`quest:<id>:<period>`,
  `bonus:allDaily:<date>`, `ach:<id>`), so ticking, unticking and re-ticking can't duplicate XP.
- **Routing** uses hash URLs and relative asset paths, so the same build works at a domain root
  (https://nutritrack-rpg.vercel.app, the live app) or in a sub-folder (the old
  `callmetobiow.github.io/nutritrack-rpg/` copy) without server configuration.

## Credits

Food data © Open Food Facts contributors, under the Open Database License.
Icons: Lucide (ISC). Fonts: Inter and Rajdhani (SIL Open Font License).
All characters, writing, artwork and the app icon are original.

Not medical advice. Targets are estimates; talk to a professional about specific health needs.
