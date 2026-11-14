# Alacena: icon and splash assets

Mark: a cupboard (top, plus two doors with cut-out handles) drawn in a 100 × 100 unit box. Its bounding box is 76 × 72 units, centred on (50, 50).

## Files

| File | What it is |
|---|---|
| `png/icon.png` | 1024², opaque, square corners. #F6F5F0 mark on #2E6A3D, mark at 59 % of the width |
| `png/ios-icon-light.png` | Same as `icon.png` |
| `png/ios-icon-dark.png` | #8CCB99 mark on a transparent background (iOS supplies the dark backdrop) |
| `png/ios-icon-dark-filled.png` | Fallback for the dark icon: the mark on #1B1E19 |
| `png/ios-icon-tinted.png` | Grayscale mark on transparent. The top is white and the doors #E0E0E0, so the layers still read once iOS applies the tint |
| `ios-layers/*.svg` | Layers for Icon Composer / Liquid Glass: background, doors and top on the same 1024 canvas. Dark-mode versions of the doors and top are included |
| `png/android-icon-foreground.png` | Transparent. Mark at 41 % of the layer; its farthest point is 280 px from the centre (the 66 % safe circle has a 338 px radius) |
| `png/android-icon-background.png` | Flat #2E6A3D |
| `png/android-icon-monochrome.png` | White silhouette on transparent |
| `png/splash-icon.png` / `-dark.png` | The mark alone on transparent, filling the full width, so `imageWidth: 76` gives a mark 76 pt wide |
| `svg/` | SVG sources for every PNG, plus `mark.svg` (master) |
| `splash-layers/{light,dark}/` | Animated layers, each with a tight viewBox, positioned in the 100 × 100 pt box (1 unit = 1 pt) |
| `splash-timing.json` | Machine-readable timing spec |
| `rn/AnimatedSplash.tsx` | Reanimated 3 implementation of the spec, including reduced motion |
| `lottie/alacena-splash-{light,dark}.json` | Bonus: 100 × 100, 60 fps, 60 frames. Mark only (doors as a 2D squash); the background fade stays in RN |

## app.json (Expo)

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "ios": {
      "icon": {
        "light": "./assets/ios-icon-light.png",
        "dark": "./assets/ios-icon-dark.png",
        "tinted": "./assets/ios-icon-tinted.png"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png",
        "backgroundColor": "#2E6A3D"
      }
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/splash-icon.png",
        "imageWidth": 76,
        "resizeMode": "contain",
        "backgroundColor": "#F6F5F0",
        "dark": { "image": "./assets/splash-icon-dark.png", "backgroundColor": "#10120F" }
      }]
    ]
  }
}
```

For iOS 26 Liquid Glass, build an `.icon` in Icon Composer from `ios-layers/`. Use the background as the fill, then put the doors and the top in separate groups, top in front. Then point `ios.icon` at that `.icon` file (supported from Expo SDK 54).

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
