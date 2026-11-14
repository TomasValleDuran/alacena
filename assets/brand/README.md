# Alacena: icon and splash assets

Source of truth for the Alacena cupboard mark: the icon and splash art, the animated splash layers and the timing spec. `apps/app/assets/images/` holds copies of some of these files for the Expo config; edit them here, then copy them there.

## The mark

A cupboard (a cornice across the top, plus two doors with cut-out handles) drawn in a 100 × 100 unit box. Its bounding box is 76 × 72 units, centred on (50, 50).

Two colours: green `#2E6A3D` and off-white `#F6F5F0`. The dark variants use `#8CCB99` (mark) and `#1B1E19` or `#10120F` (backdrop).

## Folders

| Path | Contents |
|---|---|
| `svg/` | SVG sources for every PNG, plus `mark.svg` (master) |
| `png/` | Icon and splash PNGs (listed below) |
| `ios-layers/` | Layers for Icon Composer / Liquid Glass: background, doors and cornice on the same 1024 canvas. Dark-mode versions of the doors and cornice are included |
| `splash-layers/{light,dark}/` | Animated layers, each with a tight viewBox, positioned in the 100 × 100 pt box (1 unit = 1 pt). Each set is complete |
| `lottie/alacena-splash-{light,dark}.json` | 100 × 100, 60 fps, 60 frames. Mark only (doors as a 2D squash); the background fade is not included |
| `splash-timing.json` | Machine-readable timing spec |

### PNG files

| File | What it is |
|---|---|
| `icon.png` | 1024², opaque, square corners. #F6F5F0 mark on #2E6A3D, mark at 59 % of the width |
| `ios-icon-light.png` | Byte-identical to `icon.png`. Kept under its own name because `apps/app/app.json` references it by that name |
| `ios-icon-dark.png` | #8CCB99 mark on a transparent background (iOS supplies the dark backdrop) |
| `ios-icon-dark-filled.png` | Fallback for the dark icon: the mark on #1B1E19 |
| `ios-icon-tinted.png` | Grayscale mark on transparent. The cornice is white and the doors #E0E0E0, so the layers still read once iOS applies the tint |
| `android-icon-foreground.png` | Transparent. Mark at 41 % of the layer; its farthest point is 280 px from the centre (the 66 % safe circle has a 338 px radius) |
| `android-icon-background.png` | Flat #2E6A3D |
| `android-icon-monochrome.png` | White silhouette on transparent |
| `splash-icon.png` / `splash-icon-dark.png` | The mark alone on transparent, filling the full width, so `imageWidth: 76` gives a mark 76 pt wide |

## Copies used by the app

`apps/app/app.json` reads these from `apps/app/assets/images/`, which holds byte-identical copies of the files above:

- `icon.png`
- `ios-icon-light.png`, `ios-icon-dark.png`, `ios-icon-tinted.png`
- `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`
- `splash-icon.png`, `splash-icon-dark.png`

`apps/app/assets/images/favicon.png` has no counterpart in this folder.

Duplicates kept on purpose: `svg/android-icon-background.svg` and `ios-layers/0-background.svg` are identical, but the Icon Composer set needs its own complete folder. `splash-layers/light/splash-layer-shelf.svg` and `splash-layers/dark/splash-layer-shelf.svg` are identical, but each splash set must stay complete.

The app's animated splash is `apps/app/src/components/animated-splash.tsx`. The timing below is the spec it is built from.

For iOS 26 Liquid Glass, build an `.icon` in Icon Composer from `ios-layers/`. Use the background as the fill, then put the doors and the cornice in separate groups, cornice in front. Then point `ios.icon` at that `.icon` file (supported from Expo SDK 54).

## Splash timing (ms)

| Layer | Property | From → to | Duration | Delay | Easing |
|---|---|---|---|---|---|
| interior | opacity | 0 → 1 | 140 | 60 | cubic-bezier(0.33, 0, 0.67, 1) |
| doorLeft | rotateY (origin: left) | 0° → −82° | 420 | 60 | cubic-bezier(0.22, 1, 0.36, 1) |
| doorRight | rotateY (origin: right) | 0° → 82° | 420 | 60 | cubic-bezier(0.22, 1, 0.36, 1) |
| shelf | opacity | 0 → 1 | 220 | 180 | cubic-bezier(0.33, 0, 0.67, 1) |
| mark (group) | scale | 1 → 1.25 | 340 | 560 | cubic-bezier(0.4, 0, 0.2, 1) |
| mark (group) | opacity | 1 → 0 | 340 | 560 | cubic-bezier(0.4, 0, 1, 1) |
| splashOverlay | opacity | 1 → 0 | 380 | 620 | cubic-bezier(0.4, 0, 0.2, 1) |
| appRoot | scale | 0.98 → 1 | 380 | 620 | cubic-bezier(0.4, 0, 0.2, 1) |

- The doors use perspective 400. Spring alternative: `{ damping: 24, stiffness: 180, mass: 1, overshootClamping: true }`, which settles to within 1 % in about 380 ms with no bounce.
- Reduced motion: only the splashOverlay animates, opacity 1 → 0 over 300 ms with no delay, easing cubic-bezier(0.33, 0, 0.67, 1). The doors stay closed.
- Hand-off: render the overlay, call `SplashScreen.hideAsync()` in its `onLayout`, then start. Start once fonts and local data are ready. Never wait on the network.
- Check on a real Android 12+ device that the native mark measures 76 dp. If the system splash crops or resizes it, set the overlay box to the size you measure.
