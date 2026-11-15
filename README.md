# KomaYomi Mobile

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms: Android and iOS](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-3ddc84.svg)](#requirements)
[![React Native](https://img.shields.io/badge/React%20Native-0.88-61dafb.svg)](https://reactnative.dev)

**Read the same manga page in Japanese, Chinese and English — on your phone.**

Native mobile edition of [KomaYomi](https://github.com/PayayaKamo/KomaYomi), a manga comparison
reader for reading the same pages across several language versions. Projects open straight on the
device, notes stay in a local database, and nothing is uploaded. This repository is an independent
app; the desktop project and the static web build are not part of it.

## Current features (milestone 1)

- Import a `.mnproj` project with the system file picker.
  - **Packaged** projects carry their page images inside the archive.
  - **Reference** projects store image paths; the app asks for the original image folder once and
    copies the matching pages into app storage so the project keeps working.
- Browse volumes, chapters and page thumbnails.
- Compare reader:
  - one column per language in the project, ordered by the project's `langOrder`;
  - side-by-side or overlay layout;
  - mask switch to hide languages (tap a language chip to toggle a column);
  - pan follows the finger, pinch to zoom, double tap to reset.
- Per-page Markdown notes, stored in a local SQLite database (op-sqlite), not in AsyncStorage.
- Interface in English, Simplified Chinese and Japanese, following the system language with English
  as the fallback.
- A demo project is bundled in the Android build (`Open sample project`).

Not in this milestone: automatic panel detection, WebDAV/remote storage, plugins, backup, export.
There are intentionally no UI entry points for them yet.

## Tech stack

| Area | Choice |
| --- | --- |
| Runtime | React Native 0.88.1 (new architecture), React 19.3 |
| Language | TypeScript 6 |
| Package manager | npm (lockfile committed) |
| Storage | `@op-engineering/op-sqlite` (SQLite) |
| Files | `@dr.pogodin/react-native-fs`, `@react-native-documents/picker` |
| Gestures | `react-native-gesture-handler` 3 |
| Archive | `fflate` |

Shared pure logic from the desktop app is vendored with `scripts/sync-shared.mjs` (types, project
migrations, formatting helpers, Markdown renderer). Do not edit files under `src/shared`; edit the
desktop sources and re-run the script.

## Requirements

- Node.js >= 22.11
- npm
- Android: JDK 21, Android SDK (platform 37, build-tools 37, NDK 27.1, CMake 3.22) and an emulator or
  device
- iOS: Xcode and CocoaPods on macOS (the iOS project is generated but was not built for this
  milestone)

## Run

```bash
npm install
npm run sample   # regenerate the demo .mnproj archives (optional, committed already)

# terminal 1
npm start

# terminal 2
npm run android
```

On the home screen tap **Open sample project** to import the bundled Star Cafe demo without touching
device storage. To try your own project, copy a `.mnproj` file to the device and use **Open project…**.

Useful checks:

```bash
npm run typecheck
npm test
npm run lint
```

### Reference projects

When a reference `.mnproj` is imported, the app immediately opens a folder picker. Pick the folder
that contains the volume folders (the same root the project was exported against). On Android the
picked SAF tree is copied by the small `KomaFiles` native module; on iOS the folder is read through
RNFS. If the folder is skipped, the project still opens with missing-image placeholders.

## Project layout

```
App.tsx                     state-based navigation + database bootstrap
src/shared/                 vendored pure logic from the desktop app
src/types/project.ts        manifest / config / storage types
src/lib/db.ts               SQLite schema and queries
src/lib/projectImport.ts    .mnproj import (packaged and reference)
src/lib/library.ts          manifest + images -> library view model
src/lib/files.ts            RNFS helpers and SAF folder copy bridge
src/lib/panelGeometry.ts    panel geometry ported from the desktop app
src/i18n/                   en / zh / ja catalogs and locale detection
src/screens/                home, library, page grid, reader, page notes
src/components/             compare canvas, zoom/pan surface, UI primitives
scripts/                    shared-code sync and sample archive generator
samples/                    generated demo .mnproj files
harmony/                    HarmonyOS NEXT placeholder (future milestone)
```

## HarmonyOS NEXT

HarmonyOS NEXT support is planned as a separate milestone using Huawei's React Native for OpenHarmony
(RNOH). See [harmony/README.md](harmony/README.md). No HarmonyOS code is part of this milestone.

## License

Same license as the KomaYomi desktop project: [MIT](LICENSE).
