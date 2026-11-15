# HarmonyOS NEXT (placeholder)

HarmonyOS NEXT is a later milestone and is **not implemented** in this repository yet.

Planned approach:

- Use Huawei's React Native for OpenHarmony (RNOH) to run the same TypeScript screens on HarmonyOS
  NEXT (`@react-native-oh/react-native-harmony` + the `rnoh` HAP template).
- Keep platform-specific pieces behind the small modules already isolated here:
  - file/folder access (`src/lib/files.ts`) needs an ArkTS bridge for the HarmonyOS file picker;
  - SQLite needs an RNOH-compatible database module;
  - gestures and image rendering have RNOH equivalents in the RNOH ecosystem.
- The shared code in `src/shared`, `src/lib/library.ts`, `src/lib/projectImport.ts` and `src/i18n`
  is pure TypeScript and should be reusable unchanged.

Directory layout will follow the RNOH template (`harmony/entry/src/main/ets/...`) and be added when
the milestone starts.
