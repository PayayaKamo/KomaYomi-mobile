KomaYomi Mobile __VERSION__ — Android release.

## Requirements

- Android 7.0 (API 24) or newer.
- 64-bit ARM device (`arm64-v8a`). This build does not contain x86/x86_64 or 32-bit libraries.

## Install

1. Download `KomaYomi-mobile-__VERSION__-android-__ABI__.apk` below.
2. Open the file on the device and allow installing apps from this source when prompted.

The APK is signed with the standard Android **debug keystore** because this project does not ship a
release keystore yet. It installs and runs normally, but it is a testing build: it cannot be published
to Google Play and future builds cannot upgrade it if the signing key ever changes.

## Scope

- Android only. iOS needs macOS with Xcode and your own signing setup, so it is built locally
  (see the README) instead of in CI.
- HarmonyOS NEXT is a placeholder directory and not part of this release.
- Included: `.mnproj` import (packaged and reference), volume/chapter/page browsing, the
  multi-language compare reader (mask switch, side-by-side/overlay, pan and zoom), per-page Markdown
  notes in SQLite, and English/Chinese/Japanese UI.
- Not included yet: automatic panel detection, WebDAV or other remote storage, plugins, backup and
  export.

## Versioning

The tag, this release title and the APK file name all come from `version` in `package.json`.
