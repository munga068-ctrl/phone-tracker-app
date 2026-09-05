# Phone Tracker — Android App

A native Android companion to [Phone-Tracker](https://github.com/munga068-ctrl/Phone-Tracker) that keeps reporting location even when the app is closed or the screen is off — something the web version fundamentally cannot do (browsers suspend JavaScript the moment a tab isn't visible).

It writes to the **exact same Firebase Realtime Database path** (`devices/{deviceId}`) as the web tracker, so the existing viewer page (`index.html` / `viewer.js` in the Phone-Tracker repo) works with this app with zero changes — same Device ID, same map.

## Why this needs a real build (and I can't do it for you)

This is a compiled mobile app, not a webpage — there's no way to "just open a URL" and have it working. Building it requires a step I genuinely cannot run from a chat environment (no Android SDK, no device, no emulator here). You'll need to do the build yourself, but it's mostly copy-paste:

## How to build the APK

1. **Install Node.js** (18+) if you don't already have it: [nodejs.org](https://nodejs.org)
2. **Download this repo** to your computer (`git clone` or download ZIP from GitHub).
3. Open a terminal in the folder and run:
   ```
   npm install
   npx expo install --fix
   ```
   (`--fix` lets Expo correct any package version mismatches automatically.)
4. **Create a free Expo account** if you don't have one: [expo.dev/signup](https://expo.dev/signup)
5. Install the EAS CLI and log in:
   ```
   npm install -g eas-cli
   eas login
   ```
6. **Build the APK** (this runs in Expo's cloud — no Android Studio needed):
   ```
   eas build --platform android --profile preview
   ```
   This takes a few minutes. When it finishes, it gives you a download link (also visible at [expo.dev](https://expo.dev) under your project's Builds tab).
7. **Download the `.apk` file** to your Android phone (e.g. email it to yourself, or download directly on the phone if you ran the build from the phone's browser).
8. **Install it**: tap the downloaded `.apk`. Android will warn about "installing from unknown sources" — this is expected for a sideloaded app; allow it in the prompt. No Play Store, no review process, no waiting.

## Using the app

1. Open the app, enter the same Device ID you'd use in `track.html` (6+ characters, letters/numbers/`-`/`_`).
2. Tap **Start Sharing**.
3. Grant location permission — when Android asks, choose **"Allow all the time"** (not "only while using the app"). This is the permission that makes background tracking actually work; without it, Android will pause updates the moment you leave the app.
4. You'll see a persistent notification while sharing is active — this is normal and required (it's what Android uses to keep the background service alive; removing it would let the OS kill the tracking).
5. Open the viewer (`index.html`) anywhere and add the same Device ID — it'll show up exactly like a web-tracked phone.

## What's actually different from the web version

- **expo-task-manager** registers a real background task with Android, independent of whether the app's UI is open.
- **A foreground service** (the persistent notification) tells Android "don't kill this" — this is the mechanism, not a workaround; it's how every legitimate Android background-location app works (delivery trackers, fitness apps, etc.).
- Location updates get written straight to Firebase via a plain `fetch()` call inside the background task — no UI needs to be rendered for this to happen.

## Publishing an update (so the update-notification system works)

The app checks GitHub Releases on every launch to see if a newer version exists. For that check to find anything, **every new build needs a matching GitHub Release**:

1. Bump `"version"` in `app.json` (e.g. `1.0.0` → `1.0.1`).
2. Commit and push that change.
3. Build the new APK: `eas build --platform android --profile preview`.
4. On GitHub, go to the repo → **Releases** → **Draft a new release**.
5. Set the tag to match, with a `v` prefix: `v1.0.1`.
6. Attach the built `.apk` file (drag it into the release's asset area).
7. Publish the release.

Once that's live, anyone with an older version installed will see an in-app banner and get a local notification ("Phone Tracker update available") the next time they open the app, with a tap-to-download link straight to that release's `.apk`.

If you skip this and just rebuild without creating a release, the app has no way to know a newer version exists — the check is entirely based on the published GitHub Release, not on when you last ran `eas build`.

## What this still can't do

- **A fully powered-off phone** still can't report anything — no software fix exists for that (see the main Phone-Tracker README).
- If the person **manually force-stops the app** from Android's app settings, or denies "Allow all the time" location access, tracking stops — same as it would for any tracking app.
- Very aggressive battery-optimization settings on some phones (Samsung, Xiaomi, Huawei in particular) can still kill background services despite the foreground notification. If tracking seems to stop overnight, check the phone's battery optimization settings and exclude this app from any "sleeping apps" / "deep sleep" list.
- The update check needs network access and GitHub's API to be reachable — if the phone is offline when it opens, it just silently skips the check and tries again next launch.

## Files

- `App.js` — the UI: a two-tab menu (**Share My Location** / **Find My Phone**), Device ID input, Start/Stop Sharing, the update banner, and auto-resume-after-reboot logic.
- `locationTask.js` — the background task definition that writes to Firebase. This is what keeps running after the app closes.
- `updateChecker.js` — compares the installed version against the latest GitHub Release and returns download info if a newer one exists.
- `firebaseConfig.js` — the shared Firebase project URL and Device ID sanitization (kept identical to the web repo's rules).
- `android-native/BootReceiver.kt` / `plugins/withBootReceiver.js` — native boot receiver + config plugin that posts a "tap to resume" notification after the phone restarts.
- `assets/` — app icon, Android adaptive icon, splash screen icon, and notification icon.
- `app.json` — Android permissions, icon/splash config, and plugin config for `expo-location`, `expo-notifications`, and the boot receiver.
- `eas.json` — build profile producing a directly-installable `.apk` (no Play Store needed).
