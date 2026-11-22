# Build progress

Version 0.1.0 — all ten build phases complete. Built and tested in the cloud; this folder is the full source.

- [x] Phase 1–2: architecture, IndexedDB schema, core logic (nutrition, targets, XP, quests, streaks, achievements, Open Food Facts client, 120 briefings), design system, Windows setup guide
- [x] Phase 3: app shell, briefing overlay, onboarding, Home dashboard
- [x] Phase 4: food diary, search, barcode scanner, custom foods, saved meals
- [x] Phase 5: nutrition page (macros, vitamins, minerals, trends)
- [x] Phase 6: water and weight
- [x] Phase 7: quest board, quest editor, achievements, quest history, celebrations, sounds
- [x] Phase 8: statistics, settings, backup/restore, delete-all, privacy, offline
- [x] Phase 9: icons, iOS launch screens, PWA manifest, GitHub Pages workflow, hosting and install guide, README
- [x] Phase 10: full test pass, project copy and source zip

## How it was verified

- 89 automated unit and database tests (`npm test`), TypeScript check and production build all pass.
- The GitHub Actions steps (`npm ci`, typecheck, tests, build) were run in a clean copy.
- A scripted browser run at iPhone size (390 × 844) clicked through every screen on the production
  build: onboarding, water, ticking quests with celebrations, the scanner with a simulated camera,
  typed barcode lookup, online search, diary, quests and achievements, nutrition, weight, stats,
  profile, settings, targets, then an offline reload that kept all data. No console errors.

## Not yet verified (needs the real thing)

- **Live Open Food Facts:** the cloud build environment can't reach it, so lookups and search were
  tested against realistic recorded responses. Check a few real barcodes after hosting.
- **Real iPhone camera:** the scanner was tested with a simulated camera. Check it on the phone
  once the app is on an `https://` address.
- **iOS launch screens:** generated for iPhone 8/SE up to 17 Pro Max; confirm one shows on install.

## v0.2.0 — Competitive rank (2026-11-19)

- Ladder: Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster (divisions 5→1, 100 RP each), then Zenith. Original emblems (`src/components/game/RankEmblem.tsx`).
- Each day is a match scored 0–100 from daily goals; rating moves by 120 × (score − expected), expected rising from 30 (Bronze) to 90 (Zenith). 5 placement days (capped at Platinum 1), 3-match shield after a tier promotion.
- A day locks at the end of the following day (`rankMatches` table, DB v2) and is never rewritten; an unlogged day locks as a 0 (defeat), as Tobi chose.
- Rules and balance simulations: `src/lib/rank.ts`, `src/lib/__tests__/rank.test.ts`, `src/db/__tests__/rank.test.ts`.

## v0.3.0 — Barcode scanner upgrade (2026-11-19)

- Reader: ZXing-C++ as WebAssembly (`zxing-wasm`, bundled and precached, works offline) replaces the old JS port. Reads only the viewfinder area (a square around it), one frame at a time, every third frame rotated ±35°, so upright, sideways and diagonal codes scan. A code needs two matching reads and a valid check digit; it is ignored while it stays in view. Code: `src/lib/scan/`, `src/features/food/scanner/useBarcodeCamera.ts`.
- iPhone camera: prefers the "Back Triple/Dual Wide Camera" (auto macro, sharp up close) and sets 1× zoom; torch, 1×/2× zoom and lens switch where Safari supports them; low-light and "not reading?" hints; haptic tap (iOS 18 switch trick) and beep.
- Data: English names first, `lc=en`, `app_name` sent to Open Food Facts; label serving parsed from text; "Whole pack" portion (single packs up to 750 g/ml); Nutri-Score, NOVA, completeness, alcohol. Data checks flag missing calories/macros and calories that don't match the macros (`src/lib/foodQuality.ts`), with "Fix values from the pack".
- Device first: scanned products are saved on scan (instant and offline next time), refreshed after 30 days unless the player corrected them (`Food.edited`). Offline / not-found scans go to a scan inbox (`Settings.pendingScans`), looked up automatically when back online (`src/db/scans.ts`). No DB version change.
- Quick re-log: the last portion of each food is remembered and preselected; "Recent scans" strip on the scanner.
- Whole-meal mode: scan item after item into a tray, adjust portions, log all at once (`addDiaryEntries`).
- Verified with a scripted browser run using a fake camera feed (upright, sideways and 35° tilted EAN-13s: found in ~0.8 s / ~0.8 s / ~1.8 s from page load). Still to check on the real iPhone.

## v0.7.0 — Upgradable badges (2026-11-19)

- Nine badges, each climbing the rank ladder (Bronze 5 … Grandmaster 1, Zenith) on one goal: Iron Will (protein), Wellspring (water), Deep Roots (fibre), True Aim (calories ±10%), Balanced Plate (macros), Three Squares (3 meals), Unbroken (food logged), Iron Discipline (score 70+), Flawless (score 100). Code: `src/lib/badges.ts`.
- Same maths as the rank (`stepRating` in `rank.ts`, shared): each locked day is a win (goal hit) or loss; Δ = 100 · (hit − expected). Expected rises up the ladder, so holding Gold needs ~50% of days, Diamond ~65%, Zenith 90%+. A perfect run reaches Silver in ~7 days, Gold ~16, Zenith ~16 weeks. Badges drop when the goal slips (Tobi's choice) and keep a lifetime peak; 3-match shield after a tier promotion.
- Only locked days count (same `rankMatches` records; `entries` now stored per day), so editing old days can't farm them; a day with nothing logged is a loss.
- XP once per ladder step, first time reached (`badge:<id>:<step>` ledger ids): 5 per division in Bronze, +5 per tier, 100 for Zenith.
- UI: Badges tab on the Quest board (Achievements tab renamed "Feats" to fit four tabs), detail sheet (hit rate, run, best run, wins to next division, hold rate, projection), Top badges on Profile, full-screen moment for claims and new tiers, toast for division-ups, drops shown only on the tab (`settings.badgeSeen`).
- Tests: `src/lib/__tests__/badges.test.ts` (ladder, pacing, settle sims, drops, peak, shield, XP), badge XP DB tests in `src/db/__tests__/rank.test.ts`.

## v0.6.1 — Water buttons (2026-11-19)

- Water quick-add buttons are now 100 / 250 / 500 ml (Home card and Water page, plus Custom). Players still on the old default buttons (150/250/350/500/750) are moved over on start-up; any other set is left alone (`ensureInitialized`, `src/db/__tests__/settings.test.ts`).

## v0.6.0 — New home on Vercel (2026-11-19)

- Live address moves to https://nutritrack-rpg.vercel.app (`vercel.json`; Vercel builds `main` and gives every branch a preview address).
- The old GitHub Pages copy keeps working and shows a "NutriTrack has a new home" card with a four-step guide: save backup, open new address, add to Home Screen, restore.
- Verified with an emulated iPhone: 14 days of data created on the old address, backed up from the guide, restored on the new address; all 12 data stores identical afterwards (level, streak, diary, foods, weights, XP, achievements).
- Not carried over (device-only preferences): scanner single/whole-meal mode and the chosen camera; they reset to defaults.

## v0.5.0 — Ingredients, processing and additives (2026-11-19)

- Ingredients are now read by the app itself (`src/lib/ingredients.ts`): E-numbers and additive names, plus NOVA-style ultra-processing markers (flavourings, glucose syrup, modified starch, emulsifiers, sweeteners, colours…). Used when Open Food Facts has the ingredients text but no analysis.
- When a product has no ingredients at all, the health card says so and offers "Add ingredients from the pack": photograph the list (read on the phone with tesseract.js, lazy-loaded; the engine downloads once from a CDN, the photo never leaves the phone) or type it. Saved per food (`setIngredients`), kept across later downloads, editable.
- Every reason on the health rating now explains itself in plain English with its source: each additive (UK FSA, EFSA, WHO/IARC, phrased cautiously where evidence is mixed), each ultra-processed ingredient found (flavourings, sweeteners, glucose syrup…), and sugar, salt and saturated fat against NHS daily limits.
- Opening a saved product now refreshes stale data in the background (previously only on scan), so foods saved before v0.4 pick up processing and additives. `QUALITY_VERSION` 3. No DB version change.

## v0.4.0 — Health rating and better choices (2026-11-19)

- 0–100 health rating on every food with enough data (`src/lib/healthScore.ts`). Starts at 70; points from UK FSA traffic-light limits (food and drink limits), UK sugar-tax bands for drinks, fibre and protein claim levels, fruit/veg share, NOVA processing, and flagged additives (`src/lib/additives.ts`: Southampton-six dyes with the UK warning, E171, nitrites/nitrates, sweeteners, caramel colours, phosphates, some emulsifiers). Every point is shown as a reason; tap an additive for why.
- Better choices: up to 3 higher-rated products (≥ +10 and ≥ 55) from the product's most specific Open Food Facts categories, UK first (`src/lib/alternatives.ts`). Tap one to open it.
- Products saved by v0.3 refresh their data on next scan (`QUALITY_VERSION`). No DB version change.

## Ideas for later

- Playwright end-to-end tests inside the repo (the click-through script lives outside it for now).

## v0.8.0 — Better food search and UK supermarkets (2026-11-19)
- Search ranking (`src/lib/foodSearch.ts`): plain foods before flavoured products, plurals, typos, half-typed words; 70 bundled everyday UK foods (`src/data/genericFoods.ts`); UK-first online search; typed barcode goes straight to the product; "Nothing found" card with one-tap custom food.
- Supermarkets (`src/data/supermarkets.ts`): scanned/searched products show "Tesco own brand" / "Sold at …" from Open Food Facts brand and store data. Not verified against live Open Food Facts (cloud blocked); check on the phone.
- GS1 UK lookups and supermarket sites/apps are deliberately not used (terms).

## v0.9.0 — Read the nutrition label from a photo (2026-11-20)
- Custom food page: "Photograph the nutrition label" reads the table on the phone (same Tesseract reader as ingredients) and fills the form; the player checks every number and saves. Parser: `src/lib/scan/nutritionLabel.ts` (two columns, per 100 g vs per serving, kJ/kcal, sodium to salt, "<0.5", %RI ignored) with warnings for impossible or inconsistent values.
- Not yet tried with real photos: the text reader's engine can't be downloaded from the cloud, so only the parser is tested (14 tests).
