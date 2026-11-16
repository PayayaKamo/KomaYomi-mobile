# KomaYomi Mobile

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms: Android and iOS](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-3ddc84.svg)](#requirements)
[![React Native](https://img.shields.io/badge/React%20Native-0.88-61dafb.svg)](https://reactnative.dev)

**Read the same manga page in Japanese, Chinese and English — on your phone.**

Native mobile edition of [KomaYomi](https://github.com/PayayaKamo/KomaYomi): pair the same page across
language versions, compare it full-page or panel by panel, and keep Markdown notes locally. Projects
open straight on the device, nothing is uploaded, and no account is needed. This repository is an
independent app; the desktop edition and the browser build are separate projects.

## What it can do now

- **Import** a `.mnproj` project with the system file picker.
  - Packaged projects carry their page images inside the archive.
  - Reference projects store image paths; pick the original volume folder once and the matching pages
    are copied into app storage.
- **Browse** volumes, chapters and page thumbnails.
- **Compare reader**:
  - one column per language, ordered by the project's `langOrder`;
  - side-by-side or overlay layout;
  - full page or a single panel, following the page's reading direction and explicit panel numbers;
  - mask switch to hide languages; tap a language chip to toggle a column;
  - pan follows the finger, pinch to zoom, double tap to reset;
  - **Previous / Next panel** buttons that continue onto the neighbouring page instead of stopping at
    the page edge.
- **Original view**: the uncropped page for each language, one lane on phones and two on tablets,
  with language tabs, per-pane pinch/pan, a live zoom ratio and a reset button.
- **Panel detail**: open it by double-tapping the active panel or tapping **Open panel**; every
  language shows the same crop enlarged, with **Previous / Next panel** and **Previous / Next page**
  navigation across page boundaries.
- **Deep links** restore a page, view or panel from a link, including on a cold start.
- **Edit / Read** switch in the header: read-only mode is persisted and disables note editing,
  imports and project removal in the UI.
- **Per-page Markdown notes** stored in a local SQLite database (op-sqlite), not AsyncStorage. One
  editor is reused for new and existing notes; the action reads **Add note** or **Save changes**.
- **Interface** in English, Simplified Chinese and Japanese, following the system language with
  English as the fallback.

## What it cannot do yet

- No automatic panel detection: panels are taken from the project file, not detected on the phone.
- No panel workbench: no manual panel editing, splitting, numbering or templates.
- No annotation editing or rendering.
- No plugins, WebDAV/remote storage or automatic backups.
- No export (HTML, PNG, Word, PDF/print).
- No multi-root library scanning or shared thumbnail cache.
- Read-only mode is enforced in the UI only; there is no server process to reject writes.
- No runnable HarmonyOS NEXT build yet (see [HarmonyOS NEXT](#harmonyos-next)).
- iOS project files exist, but iOS was not built for this milestone (see [iOS](#ios)).

## How to run

### Requirements

- Node.js >= 22.11 and npm.
- Android: JDK 21, Android SDK (platform 37, build-tools 37, NDK 27.1, CMake 3.22), plus an emulator
  or a USB device.
- iOS: macOS with Xcode and CocoaPods.

### Install and start

```bash
npm install
npm start           # terminal 1: Metro
npm run android     # terminal 2: build and install on an emulator or device
```

On Android the home screen shows a disabled **Sample project coming soon** button next to **Open
project…**. A sample project will be provided later; to use your own project, copy a `.mnproj` file
to the device and choose **Open project…**.

### Android device or emulator

Start an AVD in Android Studio (or connect a device with USB debugging enabled), confirm it is
visible with `adb devices`, then run `npm run android`. Debug builds use the ABI list in
`android/gradle.properties`; release builds ship `arm64-v8a`, `armeabi-v7a` and `x86_64` (see
[Releases](#releases)).

### iOS

On macOS:

```bash
cd ios && pod install && cd ..
npm run ios
```

Open `ios/KomaYomiMobile.xcworkspace` in Xcode if you prefer to build from the IDE. A physical
iPhone needs an Apple development team for signing. The iOS project is generated but was not built
for this milestone.

### Checks

```bash
npm run typecheck
npm test
npm run lint
```

## The four repositories

KomaYomi ships as four repositories that share the same project format but target different
environments.

| Repository | Role | Current scope |
| --- | --- | --- |
| [KomaYomi](https://github.com/PayayaKamo/KomaYomi) | Desktop full edition (Electron + local server) | Import and multi-root scanning, automatic panel detection, panel workbench (drag/resize, split, numbering, templates), align presets, annotations, plugins, WebDAV/backups, server-side read-only, HTML/PNG/Word/print export. |
| [KomaYomi-online](https://github.com/PayayaKamo/KomaYomi-online) | Browser-only edition | Open a `.mnproj` and read, annotate and export static HTML or PNG entirely in the browser; no server, works offline. |
| **KomaYomi-mobile** (this repo) | React Native app for Android and iOS | Import, compare across languages (side by side, overlay, original page, panel detail), notes, deep links, front-end read-only mode. |
| [KomaYomi-docs](https://github.com/PayayaKamo/KomaYomi-docs) | Documentation site generated by CI | Build artifacts pushed automatically from the desktop repository; do not edit by hand. Published at [payayakamo.github.io/KomaYomi-docs](https://payayakamo.github.io/KomaYomi-docs/). |

## Details

### Tech stack

| Area | Choice |
| --- | --- |
| Runtime | React Native 0.88.1 (new architecture), React 19.3 |
| Language | TypeScript 6 |
| Package manager | npm (lockfile committed) |
| Storage | `@op-engineering/op-sqlite` (SQLite) |
| Files | `@dr.pogodin/react-native-fs`, `@react-native-documents/picker` |
| Gestures | `react-native-gesture-handler` 3 |
| Archive | `fflate` |

### Project layout

```
App.tsx                     state-based navigation, deep links + database bootstrap
src/shared/                 vendored pure logic from the desktop app
src/types/project.ts        manifest / config / storage types
src/lib/db.ts               SQLite schema and queries
src/lib/projectImport.ts    .mnproj import (packaged and reference)
src/lib/library.ts          manifest + images -> library view model
src/lib/files.ts            RNFS helpers and SAF folder copy bridge
src/lib/imageSize.ts        intrinsic image size cache for panel crops
src/lib/panelGeometry.ts    panel geometry ported from the desktop app
src/lib/deeplink.ts         custom-scheme reader routes (`komayomi://…`)
src/lib/panelNavigation.ts  reading-order panel stepping across pages
src/i18n/                   en / zh / ja catalogs and locale detection
src/screens/                home, library, page grid, reader, panel detail, page notes
src/components/             compare/original canvases, panel crop, zoom/pan surface, UI primitives
scripts/                    shared-code sync from the desktop app
harmony/                    HarmonyOS NEXT placeholder (future milestone)
```

### Shared code

Shared pure logic is vendored from the desktop app with `scripts/sync-shared.mjs` (types, project
migrations, formatting helpers, Markdown renderer, reading-order helpers). Do not edit files under
`src/shared`; change the desktop sources and re-run:

```bash
npm run sync:shared
```

### Deep links

The app registers the `komayomi` scheme on Android and iOS:

```
komayomi://reader/<volume>/<chapter>/<page>/<compare|original>[/panel/<id>]
```

Pages are 1-based in the link and converted to the app's zero-based index. A link opens the matching
project, page and view; a `panel/<id>` suffix opens the panel detail view. Links are handled on a
cold start and while the app is already running. If several imported projects contain the same
volume and chapter ids, the first match is used.

### Reference projects

When a reference `.mnproj` is imported, the app immediately opens a folder picker. Pick the folder
that contains the volume folders (the same root the project was exported against). On Android the
picked SAF tree is copied by the small `KomaFiles` native module; on iOS the folder is read through
RNFS. If the folder is skipped, the project still opens with missing-image placeholders.

### Releases

Releases are built by [.github/workflows/release.yml](.github/workflows/release.yml). The workflow
runs on every `v*` tag and can also be started by hand (`workflow_dispatch`). It builds every Android
release artifact, uploads them as workflow artifacts, and creates or updates the GitHub Release with
them attached:

| Artifact | Architectures | Notes |
| --- | --- | --- |
| `KomaYomi-mobile-<version>-android-universal.apk` | arm64-v8a + armeabi-v7a + x86_64 | One file that installs on any supported device; the largest download. |
| `KomaYomi-mobile-<version>-android-arm64-v8a.apk` | arm64-v8a | Smallest APK for current phones and tablets. |
| `KomaYomi-mobile-<version>-android-armeabi-v7a.apk` | armeabi-v7a | Older 32-bit ARM phones. |
| `KomaYomi-mobile-<version>-android-x86_64.apk` | x86_64 | x86_64 emulators and Intel-based Chromebooks. |
| `KomaYomi-mobile-<version>-android.aab` | all three | Google Play upload; not installable on a device directly. |

- Only Android artifacts are published. iOS cannot be built on GitHub-hosted runners because it
  needs macOS plus Apple signing certificates, so iOS builds have to be produced locally with Xcode.
- The React Native, Hermes and op-sqlite native libraries exist for every architecture above; 32-bit
  x86 (`x86`) is not packaged.
- The APKs and the AAB are signed with the standard Android debug keystore; no keystore or password is
  stored in this repository. Treat published APKs as testing builds, not store-ready packages, and
  note that changing the signing key breaks in-place upgrades.
- The version comes from `version` in [package.json](package.json). The tag must be `v<version>` and
  is validated in CI, so tag, release title and artifact names always match. The Android
  `versionCode` is derived from the same version (`major * 10000 + minor * 100 + patch`).
- Every release's changes are listed in [CHANGELOG.md](CHANGELOG.md).

To cut a release:

```bash
npm version 0.2.0 --no-git-tag-version
git commit -am "Bump version to 0.2.0"
git push
git tag v0.2.0
git push origin v0.2.0
```

### HarmonyOS NEXT

HarmonyOS NEXT is **not supported yet**. Support is planned as a separate milestone using Huawei's
React Native for OpenHarmony (RNOH). The [`harmony/`](harmony/) directory only contains a placeholder
README: there are no ArkTS pages, project files, dependencies or build configuration, so there is no
runnable HarmonyOS build. See [harmony/README.md](harmony/README.md).

### License

Same license as the KomaYomi desktop project: [MIT](LICENSE).
