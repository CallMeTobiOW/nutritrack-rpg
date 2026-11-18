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

## Ideas for later

- Playwright end-to-end tests inside the repo (the click-through script lives outside it for now).
