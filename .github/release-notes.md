KomaYomi Mobile __VERSION__ — Android release.

Read the same manga page in Japanese, Chinese and English on your phone. See `CHANGELOG.md` for the
full list of changes in this version.

## Downloads

| File | Architectures | Size | Use it when |
| --- | --- | --- | --- |
| `KomaYomi-mobile-__VERSION__-android-universal.apk` | arm64-v8a + armeabi-v7a + x86_64 | __SIZE_UNIVERSAL__ | You do not know the CPU of your device, or you want one file that installs anywhere. |
| `KomaYomi-mobile-__VERSION__-android-arm64-v8a.apk` | arm64-v8a | __SIZE_ARM64__ | Almost every phone and tablet sold since ~2015. Smallest download for real devices. |
| `KomaYomi-mobile-__VERSION__-android-armeabi-v7a.apk` | armeabi-v7a | __SIZE_ARMV7__ | Older 32-bit ARM phones. |
| `KomaYomi-mobile-__VERSION__-android-x86_64.apk` | x86_64 | __SIZE_X86_64__ | x86_64 emulators and Intel-based Chromebooks. |
| `KomaYomi-mobile-__VERSION__-android.aab` | all three | __SIZE_AAB__ | Google Play uploads. Android cannot install an AAB directly; use one of the APKs above to test. |

The split APKs contain the native libraries for exactly one architecture, so each is smaller than the
universal APK; the universal APK is the largest because it carries all three. Install exactly one of
them — the app id is the same in every file.

Every artifact contains the React Native, Hermes and op-sqlite native libraries for the listed
architectures. 32-bit x86 (`x86`) is not built: it is not needed by current emulators and no longer
worth the extra build time.

## Requirements

- Android 7.0 (API 24) or newer.

## Install

1. Download one APK from the table above.
2. Open the file on the device and allow installing apps from this source when prompted.
3. If Android refuses the update with a signature error, uninstall the previous build first.

## Signing

The APKs and the AAB are signed with the standard Android **debug keystore** because this project
does not ship a release keystore. They install and run normally, but:

- they cannot be published to Google Play — an AAB for the store must be signed with your own upload
  key;
- future builds cannot be installed over them if the signing key ever changes, so uninstall the old
  copy before switching keys.

No keystore, password or signing secret is stored in this repository.

## Platforms

- Android only. iOS needs macOS with Xcode and your own signing setup, so it is built locally (see the
  README) instead of in CI.
- HarmonyOS NEXT is a placeholder directory and not part of this release.

## Versioning

The tag, this release title, the artifact names and the Android `versionCode`
(`major * 10000 + minor * 100 + patch`) all come from `version` in `package.json`.
