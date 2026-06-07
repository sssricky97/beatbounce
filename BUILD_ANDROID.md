# Hugging Pop - Android (Capacitor) Build Guide

This branch (`android-playstore`) wraps the existing web game in a
[Capacitor](https://capacitorjs.com/) Android shell and produces a signed
`.aab` for Google Play. The web game itself is unchanged; it is copied into
`www/` at build time with Phaser vendored locally so the app runs offline.

## What is already configured

- **App name:** Hugging Pop
- **Package (applicationId):** `com.rickylaserart.huggingpop` (permanent on Play)
- **Orientation:** portrait (locked in `AndroidManifest.xml`)
- **Fullscreen:** immersive (system bars hidden in `MainActivity.java`)
- **Icons + splash:** generated for all densities (adaptive + legacy + light/dark)
- **Offline:** Phaser is vendored into `www/vendor/phaser.min.js`
- **Signing:** wired to read `android/key.properties` (gitignored)
- **SDK targets:** compile/target 35, min 23 (Play-compliant)

## Prerequisites (not installed on the build machine yet)

1. **JDK 21** (or 17). Set `JAVA_HOME`.
2. **Android SDK** - easiest via [Android Studio](https://developer.android.com/studio).
   On first open, let it install SDK Platform 35 + build-tools.
   Set `ANDROID_HOME` (e.g. `C:\Users\Ricky\AppData\Local\Android\Sdk`).
3. Node deps are already installed (`npm install` if checking out fresh).

## One-time: create the upload keystore

Keep the `.jks` file and passwords safe and backed up. If you lose them you
cannot push updates to the same Play listing.

```bash
keytool -genkey -v -keystore hugging-pop-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias hugging-pop
```

Place `hugging-pop-release.jks` in the repo root (it is gitignored), then:

```bash
cp android/key.properties.example android/key.properties
# edit android/key.properties and set the real passwords
```

## Build the release AAB

```bash
# 1. Rebuild the web root and sync it into the native project
npm run sync

# 2. Build the signed app bundle
cd android
./gradlew bundleRelease          # Windows: .\gradlew.bat bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`
Upload that file to the Play Console.

For a signed APK instead (sideload/testing):

```bash
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

## Open in Android Studio (recommended for first run / emulator test)

```bash
npm run open:android
```

Then Build > Generate Signed App Bundle, or run on an emulator/device.

## Updating the game later

The native shell rarely changes. When the web game updates:

```bash
npm run sync     # re-copies game.js/assets into www/ and into android/
```

Bump `versionCode` (and `versionName`) in `android/app/build.gradle` for every
Play upload.

## Regenerating artwork

Source art lives in `assets/` and is produced by `scripts/generate-art.mjs`:

```bash
node scripts/generate-art.mjs   # re-render assets/icon.png, splash.png, ...
npm run assets                  # regenerate all android densities
```

To use your own art instead, drop a 1024x1024 `assets/icon.png` (and optional
`assets/icon-foreground.png` / `assets/icon-background.png` / `assets/splash.png`)
and run `npm run assets`.

## Fonts (bundled, offline)

The Fredoka + Caveat fonts are bundled locally (`assets/fonts/*.woff2` +
`assets/fonts.css`) so the app renders identically with no network. They are
copied into `www/` by `npm run build:web`. To refresh or change the font set,
edit and re-run `node scripts/fetch-fonts.mjs`, then `npm run sync`.
