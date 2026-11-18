# NutriTrack RPG — Windows PC setup

You don't need any of this to *use* the app on your iPhone. You need it only when you
want to edit, test or publish the app from your own PC. Everything here is free.

## 1. Software to install

| Software | Why | Cost |
|---|---|---|
| **Node.js (LTS version)** | Runs the build tools (Vite, TypeScript, tests). Includes `npm`. | Free |
| **Git for Windows** | Version control, and how the app is uploaded to GitHub for hosting. | Free |
| **Visual Studio Code** | Code editor (recommended, optional). | Free |
| **A GitHub account** | Free hosting with HTTPS via GitHub Pages. Sign up at https://github.com | Free |

You do **not** need a Mac, Xcode, Expo, an Apple Developer membership or any paid tool.

## 2. Install with PowerShell

Open **PowerShell** (Start menu → type "PowerShell" → open it). Run these one at a time.
`winget` is built into Windows 10 (recent updates) and Windows 11.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
winget install --id Microsoft.VisualStudioCode -e
```

Accept any prompts. Then **close PowerShell and open a new window** so it picks up the new programs.

If `winget` is not recognised, install manually instead:
- Node.js LTS: https://nodejs.org (the "LTS" button)
- Git: https://git-scm.com/download/win (all default options are fine)
- VS Code: https://code.visualstudio.com

## 3. Check everything installed

```powershell
node -v
npm -v
git --version
```

You should see version numbers, e.g. `v22.x.x` (any LTS version 20 or newer is fine), `10.x.x`, `git version 2.x`.

### If PowerShell says "running scripts is disabled on this system"

Windows blocks `npm` scripts in PowerShell by default. Allow scripts for your user only:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Type `Y` and press Enter, then try `npm -v` again.

## 4. Put the project on your PC

1. Download the `nutritrack-rpg` folder (or the `nutritrack-rpg-source.zip`) from the project files.
2. Unzip/copy it to `C:\Projects\nutritrack-rpg` (create the `Projects` folder if needed).

Then in PowerShell:

```powershell
cd C:\Projects\nutritrack-rpg
npm install
```

`npm install` downloads the libraries into a `node_modules` folder (a few minutes the first time).

## 5. Everyday commands

```powershell
npm run dev        # start the app at http://localhost:5173 (Ctrl+C to stop)
npm test           # run the automated tests
npm run typecheck  # check the TypeScript for errors
npm run build      # create the production build in the dist folder
npm run preview    # serve the production build locally (tests the offline/PWA build)
```

Open http://localhost:5173 in Chrome or Edge on the PC to use the app there.

### Opening the dev version on your iPhone (same Wi-Fi)

```powershell
npm run dev -- --host
```

Vite prints a "Network" address such as `http://192.168.1.20:5173`. You can open that in Safari
on your iPhone to look at the app, **but the barcode scanner will not work there**: iPhones only
allow camera access on secure `https://` sites. For the real installed app (with the camera),
use the hosted HTTPS version — see `docs/HOSTING-AND-INSTALL.md`.

## 6. Opening the project in VS Code

```powershell
cd C:\Projects\nutritrack-rpg
code .
```

Useful extensions (optional): "Tailwind CSS IntelliSense", "Vitest".
