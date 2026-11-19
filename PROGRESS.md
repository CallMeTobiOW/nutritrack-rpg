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

## v0.4.0 — Health rating and better choices (2026-11-19)

- 0–100 health rating on every food with enough data (`src/lib/healthScore.ts`). Starts at 70; points from UK FSA traffic-light limits (food and drink limits), UK sugar-tax bands for drinks, fibre and protein claim levels, fruit/veg share, NOVA processing, and flagged additives (`src/lib/additives.ts`: Southampton-six dyes with the UK warning, E171, nitrites/nitrates, sweeteners, caramel colours, phosphates, some emulsifiers). Every point is shown as a reason; tap an additive for why.
- Better choices: up to 3 higher-rated products (≥ +10 and ≥ 55) from the product's most specific Open Food Facts categories, UK first (`src/lib/alternatives.ts`). Tap one to open it.
- Products saved by v0.3 refresh their data on next scan (`QUALITY_VERSION`). No DB version change.

## Ideas for later

- Playwright end-to-end tests inside the repo (the click-through script lives outside it for now).
