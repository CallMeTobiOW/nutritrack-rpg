# NutriTrack RPG — hosting and installing on iPhone

NutriTrack RPG is a web app (a PWA). To install it on your iPhone it has to be hosted on a
website with an `https://` address. The app now lives on **Vercel** at
https://nutritrack-rpg.vercel.app (free, HTTPS automatically). It used to live on GitHub Pages,
which still works and is described below. No Mac, App Store or Apple Developer membership is needed.

## Why it must be HTTPS

- **Camera:** iPhones only let a website use the camera on a secure (`https://`) page.
  On a plain `http://` address (for example your PC's dev server over Wi-Fi) the barcode
  scanner cannot start. Typing a barcode still works there.
- **Offline mode:** the service worker that makes the app work without a connection also
  only runs on HTTPS (or `localhost`).

Vercel, GitHub Pages and Netlify all serve HTTPS automatically.

---

## Current host: Vercel

`vercel.json` holds the settings (build with `npm run build`, publish `dist`, and cache rules
so the offline service worker always picks up new versions). Vercel builds from GitHub by itself:

- every push to `main` goes live at https://nutritrack-rpg.vercel.app
- every other branch and pull request gets its own preview address, so changes can be tried on
  the phone before they go live

GitHub Actions still type-checks, tests and publishes the old GitHub Pages copy on each push.

### One-time setup (already done once, here for reference)

1. Go to https://vercel.com/signup and choose **Continue with GitHub**. Pick the free **Hobby** plan.
2. Go to https://vercel.com/new. Under **Import Git Repository**, find `nutritrack-rpg` and
   click **Import**. (If it isn't listed, click **Adjust GitHub App Permissions** and allow it.)
3. Set **Project Name** to `nutritrack-rpg`. This name becomes the address
   `nutritrack-rpg.vercel.app`. Leave every other setting as it is; Vercel reads `vercel.json`.
4. Click **Deploy** and wait about a minute.

If you pick a different project name, change `NEW_HOME_URL` in `src/lib/hosting.ts` to match.

### Moving from the old GitHub Pages address

A new address is a separate app on iPhone, with its own empty storage. The old copy shows a
**NutriTrack has a new home** card on its Home screen that walks through it:

1. Save a backup (Share sheet, then **Save to Files**).
2. Open the new address in Safari and add it to the Home Screen.
3. In the new app, tap **Restore from a backup** on the welcome screen and pick the file.
4. Check everything is there, then delete the old icon.

---

## Previous host: GitHub Pages

The project already contains `.github/workflows/deploy.yml`. Every time you push to the
`main` branch, GitHub type-checks the code, runs the tests, builds the app and publishes it.

### 1. Create the repository (on GitHub's website, works on iPhone too)

1. Sign in at https://github.com (create a free account if you don't have one).
2. Tap **+** → **New repository**.
3. Name: `nutritrack-rpg`. Visibility: **Public** (GitHub Pages is free for public repositories).
   Don't tick "Add a README".
4. Tap **Create repository**.

A public repository shows the app's **source code**, never your data: your diary, weight and
everything else stays in your phone's storage and is never uploaded.

### 2. Turn on Pages

In the repository: **Settings** → **Pages** → **Build and deployment** → **Source**: choose
**GitHub Actions**. (Nothing else to fill in.)

### 3. Upload the code (from your Windows PC)

Follow `docs/SETUP-WINDOWS.md` first so Node.js and Git are installed. Then in PowerShell,
replacing `YOUR-USERNAME` with your GitHub username:

```powershell
cd C:\Projects\nutritrack-rpg
git init
git add .
git commit -m "NutriTrack RPG"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/nutritrack-rpg.git
git push -u origin main
```

The first push opens a browser window to sign in to GitHub. If Git asks for your name and
email first, run these once and try the commit again:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 4. Wait for the deploy

Open the repository's **Actions** tab. The "Deploy to GitHub Pages" run takes about 1–2
minutes. When it shows a green tick, the app is live at:

```
https://YOUR-USERNAME.github.io/nutritrack-rpg/
```

### Publishing changes later

```powershell
git add .
git commit -m "Describe the change"
git push
```

The installed app notices the new version and shows "A new version of NutriTrack is ready".
Tap **Update** to switch to it. Your data is kept.

---

## Alternative: Netlify Drop (no Git needed, needs a computer browser)

1. On the PC: `npm install` then `npm run build`. This creates a `dist` folder.
2. Go to https://app.netlify.com/drop and drag the **`dist`** folder onto the page.
3. Netlify gives you an `https://….netlify.app` address. Create a free account to keep it.

To update, build again and drag the new `dist` folder onto the same site's **Deploys** page.

---

## Installing on your iPhone

1. Open the app's `https://` address in **Safari** (other browsers on iPhone can't install it
   the same way).
2. Tap **Share** (the square with the arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Name it **NUTRITRACK** and tap **Add**.
5. Open it from the Home Screen. It runs full screen, without Safari's address bar, and works offline.

The first time you scan a barcode, iOS asks for camera permission. Tap **Allow**.

### Safari and the installed app have separate storage

The Home Screen app keeps its **own** data, separate from Safari tabs. If you used the app in
Safari first and want to keep that data:

1. In Safari: **Profile → Settings & data → Export**, and save the file to Files.
2. In the installed app: **Settings & data → Restore** (or **Restore from a backup** on the welcome
   screen) and pick that file.

### Keeping your data safe

- All data lives only on the phone. There is no account or cloud copy.
- Export a backup now and then (**Profile → Settings & data → Export → Save to Files**),
  especially before changing phones, resetting Safari data, or deleting the app.
- Deleting the Home Screen icon deletes its data too.
- iOS may clear website data for apps that haven't been opened for several weeks. Installing to
  the Home Screen and opening it regularly makes this much less likely; backups are the safety net.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Scanner says the camera is blocked | Check you're on the `https://` address. Then iPhone **Settings → Apps → Safari → Camera** → **Ask** or **Allow**, and reopen the app. |
| Scanner can't read a code | Hold the phone 10–20 cm away with the barcode filling the frame, add light (the torch button, where shown), or type the number under the barcode. |
| "Product not found" | Open Food Facts doesn't have it yet. Create a custom food from the label; the app never guesses nutrition values. |
| Search or barcode lookup fails | Open Food Facts needs a connection. Everything else works offline. |
| The Pages address shows 404 | Wait a minute after the first deploy, check the Actions run is green, and that Pages → Source is "GitHub Actions". |
| Actions run failed | Open the run to see which step failed (type check, tests or build). Run the same command on the PC (`npm run typecheck`, `npm test`, `npm run build`) to see the error. |
| No update banner after pushing | Close the app fully (swipe it away in the app switcher) and open it again. |
