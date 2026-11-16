# Changelog

All notable changes to KomaYomi Mobile are documented here. The version comes from `version` in
`package.json`; release notes for the matching GitHub tag are generated from `.github/release-notes.md`.

## [0.2.2] - 2026-11-17

### Added

- **Ready-to-read sample project**: the home screen offers **Open sample project**, which downloads
  the 65 MB demo archive once from the `demo-library-v1` release (progress, cancel, retry), caches it
  in the documents folder and imports it through the regular archive pipeline. The demo lives in its
  own project row (`demo-library`), so it never replaces a user project, shows a **Sample** badge and
  can be removed; removing it keeps the cached archive, so it reopens offline without downloading
  again. Repeated taps open the existing import instead of importing twice.

### Fixed

- A fast double tap on **Open sample project** no longer starts two imports at once; both would have
  unpacked into the same scratch directory and slowed the import down considerably.

## [0.2.1] - 2026-11-16

### Fixed

- Importing a large project no longer freezes the app: archives are unpacked natively with a
  streaming `ZipFile` into a temporary directory instead of going through the JavaScript layer. A
  67.6 MB project drops from roughly 290 seconds to roughly 10 seconds. The 0.2.0 APK did not
  include this fix, so 0.2.1 is the first published build with it.

## [0.2.0] - 2026-11-16

### Added

- **Original view** for the uncropped page of every language: one lane on phones and two lanes on
  tablets, language tabs to switch the visible lane, pinch to zoom and drag to pan, a live zoom ratio
  readout and a reset button. Reachable from the compare header and from
  `komayomi://reader/<volume>/<chapter>/<page>/original`.
- **Panel detail view**: double-tap the active panel (or tap **Open panel**) to see the same crop
  enlarged for every language, with the per-page Markdown notes attached to that panel.
- **Panel detail deep links** via `komayomi://reader/<volume>/<chapter>/<page>/compare/panel/<id>`,
  restored on a cold start as well as while the app is running.
- **Previous / Next panel** buttons on the detail screen that cross page boundaries instead of
  stopping at the page edge, plus **Previous / Next page** buttons in the same toolbar.
- **Front-end read-only mode** toggled from the header: the choice is persisted and disables note
  editing, imports and project removal in the UI.

### Changed

- Page notes use a single editor for new and existing notes; the submit button reads **Add note** or
  **Save changes** depending on whether an existing note is being edited.
- Release builds now publish a universal APK, three per-ABI APKs (`arm64-v8a`, `armeabi-v7a`,
  `x86_64`) and an AAB for store uploads, all named from the `package.json` version. The Android
  `versionCode` is derived from the version (`major * 10000 + minor * 100 + patch`).

### Removed

- The bundled sample project and its generator script. The home screen keeps a disabled
  **Sample project coming soon** slot until a new sample `.mnproj` is provided.

## [0.1.0]

First milestone: `.mnproj` import (packaged and reference), volume/chapter/page browsing, the
multi-language compare reader (side-by-side and overlay, mask switch, pan and zoom), per-page Markdown
notes in SQLite, English/Chinese/Japanese UI, and the `komayomi` deep link scheme.
