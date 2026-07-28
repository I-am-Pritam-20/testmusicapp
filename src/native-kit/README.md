# native-kit — reusable across projects

This folder + its Android Gradle modules are the portable "native kit" —
each piece has no app-specific coupling beyond its own package name.

| Piece | Where |
|---|---|
| Playback engine (queue/transport/modes/events over TurboModule) | `specs/NativeMusicPlayerModule.ts` + `MusicPlayer.ts` + `android/media-core/` |
| Native draggable bottom sheet (one shell, reused by every sheet in the app) | `specs/NativeBottomSheetViewNativeComponent.ts` + `NativeBottomSheet.tsx` + `android/native-bottom-sheet/` |
| Device-folder scanning (picker + real-path resolution + batched native metadata) | `DeviceLibrary.ts` + `specs/DeviceLibraryModule.ts` + `android/media-core/.../DeviceLibraryModule.kt` |
| Real internet-reachability check (generate_204 probe + NetworkCallback, not just NetInfo) | `NetworkReachability.ts` + `specs/NetworkReachabilityModule.ts` + `android/network-kit/` |
| Home-screen "now playing" widget bridge | `WidgetBridge.ts` + `specs/InoWidgetBridge.ts` + `android/app/.../widget/WidgetBridgeModule.kt` |
| Audio focus (permanent/transient loss, duck, gain) | `AudioFocus.ts` + `specs/AudioFocusModule.ts` + `android/app/.../AudioFocusModule.kt` |

Notification shuffle/repeat buttons are native Media3 `CommandButton`s
configured directly on `PlaybackService`'s `MediaSession` — there's no
separate JS-facing module for that; it's inherent to the playback engine.

## To reuse a piece in another RN project

1. Copy the relevant `.ts`/`.tsx` file(s) from this folder (and its
   `specs/` entry) into the new project's `src/native-kit`.
2. Copy the matching Android Gradle module (`media-core`,
   `native-bottom-sheet`, or `network-kit`) into the new project's
   `android/` folder. The widget and audio-focus pieces currently live
   directly under `android/app/src/main/java/com/inotuneoffline/` rather
   than their own Gradle module, since the widget in particular is
   inherently tied to this app's own `MainActivity`/notification setup —
   pulling those two into a portable module of their own would be the
   natural next step if reusing them elsewhere.
3. In the new project's `android/settings.gradle`, add an `include(...)`
   line for whichever Gradle module(s) you copied.
4. In the new project's `android/app/build.gradle`, add a matching
   `implementation(project(...))` line for each.
5. In `MainApplication.kt`, register each piece's package — e.g.
   `NativeMusicPlayerPackage()`, `NativeBottomSheetPackage()`,
   `DeviceLibraryPackage()`, `NetworkReachabilityPackage()`,
   `WidgetBridgePackage()`, `AudioFocusPackage()`.
6. Merge this project's `codegenConfig` block (package.json) into the new
   project's, pointing `jsSrcsDir` at wherever you put `native-kit/specs`.

No manual manifest edits needed for `media-core`'s own permissions/service
— those merge in automatically from its own `AndroidManifest.xml`. The
widget and audio-focus permissions/receivers/services, however, are
declared directly in the app module's manifest (see the note in point 2
above), so those DO need copying by hand if reused elsewhere.

## Why the TurboModules aren't codegen-typed on Android

Every native module here (`NativeMusicPlayerModule.kt`,
`DeviceLibraryModule.kt`, `NetworkReachabilityModule.kt`,
`WidgetBridgeModule.kt`, `AudioFocusModule.kt`) is a plain
`ReactContextBaseJavaModule` + `TurboModule` marker rather than extending
a generated Spec class, on purpose — that generated class only exists
inside whichever app's build consumes it, which would tie a standalone
Gradle module back to one specific app. The tradeoff is losing
compile-time signature checking against the `.ts` spec on Android (iOS
could still use codegen normally if you add it later). If you eventually
publish one of these as a real versioned npm package, switching to
codegen becomes straightforward.

## Not yet included

- iOS counterpart for any of the above (AVPlayer/MPNowPlayingInfoCenter +
  a Fabric bottom sheet + an iOS widget via WidgetKit) — this whole kit is
  Android-only right now.
- Extracting the truly portable pieces (media-core, native-bottom-sheet,
  network-kit) into a proper standalone npm package (workspaces/`file:`
  link) — worth doing once you're reusing them in a second project for
  real, since npm-package extraction lets Android codegen fully type the
  modules.
