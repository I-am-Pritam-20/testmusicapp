# native-kit — reusable across projects

This folder + two Android Gradle modules are the portable "native kit":
playback engine and native bottom sheet, with no app-specific coupling.

| Piece | Where |
|---|---|
| Playback engine (queue/transport/modes/events over TurboModule) | `specs/NativeMusicPlayerModule.ts` + `MusicPlayer.ts` + `android/media-core/` |
| Native draggable bottom sheet | `specs/NativeBottomSheetViewNativeComponent.ts` + `NativeBottomSheet.tsx` + `android/native-bottom-sheet/` |

## To reuse in another RN project

1. Copy this whole `src/native-kit` folder into the new project.
2. Copy `android/media-core` and/or `android/native-bottom-sheet` into the
   new project's `android/` folder.
3. In the new project's `android/settings.gradle`, add:
   ```gradle
   include(":media-core")
   include(":native-bottom-sheet")
   ```
4. In the new project's `android/app/build.gradle`, add:
   ```gradle
   implementation(project(":media-core"))
   implementation(project(":native-bottom-sheet"))
   ```
5. In `MainApplication.kt`, register both packages:
   ```kotlin
   add(NativeMusicPlayerPackage())
   add(NativeBottomSheetPackage())
   ```
6. Merge this project's `codegenConfig` block (package.json) into the new
   project's, pointing `jsSrcsDir` at wherever you put `native-kit/specs`.

No manual manifest edits needed for permissions/service — they merge in
automatically from `media-core`'s own `AndroidManifest.xml`.

## Why the TurboModule isn't codegen-typed on Android

`NativeMusicPlayerModule.kt` is a plain `ReactContextBaseJavaModule` +
`TurboModule` marker rather than extending a generated Spec class, on
purpose — that generated class only exists inside whichever app's build
consumes it, which would tie `:media-core` back to one specific app. The
tradeoff is losing compile-time signature checking against the `.ts` spec
on Android (iOS could still use codegen normally if you add it later). If
you eventually publish this as a real versioned npm package, switching to
codegen become straightforward.

## Not yet included

- iOS counterpart (AVPlayer/MPNowPlayingInfoCenter + a Fabric bottom sheet).
- Extracting this into a proper standalone npm package (workspaces/`file:`
  link) — worth doing once you're reusing it in a second project for real,
  since npm-package extraction lets Android codegen fully type the module.
