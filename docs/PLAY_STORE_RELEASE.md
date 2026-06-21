# Hugging Pop — Google Play Release Pack

## App identity (verified in project)
| Field | Value | Status |
|-------|-------|--------|
| App name | Hugging Pop | OK |
| Package / applicationId | com.rickylaserart.huggingpop | OK (final, cannot change after publish) |
| versionCode | 1 | OK for first release |
| versionName | 1.0 | OK |
| minSdkVersion | 23 (Android 6.0) | OK |
| targetSdkVersion | 35 (Android 15) | OK — meets Play requirement |
| compileSdkVersion | 35 | OK |
| Orientation | portrait (locked) | OK |
| Launcher + adaptive icon | present (mipmap + anydpi-v26) | OK |

## Permissions
- Declared: `android.permission.INTERNET` only.
- The packaged game makes **zero network requests** (Phaser + fonts are bundled
  locally; only local storage is used). INTERNET is therefore **not required**
  and can be removed for a cleaner data-safety story.

## Data Safety form answers (Play Console)
- Does your app collect or share any user data? **No.**
- Data stored on-device only (best score + settings via local storage) is **not**
  "collection" under Play's definition because it is never transmitted off device.
- Is all data encrypted in transit? **N/A (no data leaves the device).**
- Can users request deletion? Data is removed on uninstall.

## Advertising ID
- No ads, no AdMob, no ads SDK. The app does **not** use the Advertising ID.
- In Play Console, answer **No** to "uses advertising ID". No `AD_ID` permission
  is present (correct).

## Content rating
- Casual arcade game, no violence, no user interaction, no purchases.
- Expected rating: **Everyone / PEGI 3**.
- Answer "No" to all questionnaire categories (violence, sexual content, drugs,
  gambling, user-generated content, data sharing).

## Store listing copy

**App name:** Hugging Pop

**Short description (max 80 chars):**
Bounce up endless bubbles in this cute one-tap arcade jumper. Easy to play!

**Full description:**
Hop, bounce and climb as high as you can in Hugging Pop — a cheerful one-tap
arcade jumper!

Tap and hold to charge your jump, release to spring from bubble to bubble, and
see how high you can climb. Miss a bubble and it is a long way down!

Features:
- Simple one-tap controls anyone can pick up
- Three difficulties: Easy, Medium and Hard
- A colorful DISCO mode with music and party visuals
- Chase your best height and best combo
- Cute hand-drawn cartoon art and a relaxing sky world
- Plays fully offline — no ads interrupting your run, no sign-in

Light up the sky and beat your high score!

## Graphic assets to prepare (NOT yet in project — you must create these)
| Asset | Spec | Required |
|-------|------|----------|
| App icon | 512 x 512 PNG, 32-bit | Yes |
| Feature graphic | 1024 x 500 PNG/JPG | Yes |
| Phone screenshots | min 2 (up to 8), 16:9 or 9:16, >= 320px | Yes |
| 7" / 10" tablet screenshots | optional but recommended | Optional |
| Privacy policy URL | host docs/PRIVACY_POLICY.md publicly | Yes |

## Build / signing
- Recommended: upload an **AAB** (`.aab`) and enroll in **Play App Signing**.
- No keystore exists yet (`android/key.properties` not found). Create an upload
  keystore before building a release. **Back it up** — losing it blocks updates
  (unless on Play App Signing, where Google can help recover the upload key).
- R8/ProGuard: `minifyEnabled false`. Fine to leave off for a WebView game;
  optional to enable for a slightly smaller build.

## Asset license review (action required)
- Phaser 3.80.1 — MIT — OK to ship.
- Fredoka, Caveat fonts — SIL OFL — OK to ship commercially.
- Audio: `disco.mp3`, `normal.mp3`, and voice clips — **confirm you own or are
  licensed for these.** Copyrighted music is the #1 cause of game takedowns.
- `images/disco/crowd.png` — a real photo; **confirm license** (replace with an
  illustrated crowd if unsure).
