# Alacena app

The Expo app for Alacena. One codebase runs on iOS, Android and the web. Rules for coding agents are in [AGENTS.md](AGENTS.md). Repository setup is in the [root README](../../README.md).

## Stack

- Expo SDK 58 (`expo` ~58.0.25), React 19.3, React Native 0.88
- expo-router ~58 with typed routes (`experiments.typedRoutes`)
- React Compiler (`experiments.reactCompiler`)
- zustand 5 for state (`src/store`)
- expo-camera for barcodes on native (the web has no camera scanner), expo-sqlite key-value store for preferences (native), localStorage on the web
- expo-image, react-native-svg, react-native-reanimated (splash), react-native-gesture-handler
- Jest with `jest-expo`

## Scripts

Run from `apps/app` (or use the `app:*` aliases in the root `package.json`).

| Command | What it does |
|---|---|
| `npm run start` | Start the Expo dev server (`expo start`). |
| `npm run ios` | Start and open an iOS simulator (`expo start --ios`). |
| `npm run android` | Start and open an Android emulator (`expo start --android`). |
| `npm run web` | Start the dev server and open the web app (`expo start --web`). |
| `npm run lint` | `expo lint` (ESLint, `eslint-config-expo`). |
| `npm test` | Jest. |
| `npm run typecheck` | `tsc --noEmit`. |

## Screens

Routes live only in `src/app`. The tabs are the main screens. The other routes are sheets, which open over the tabs.

Tabs (`src/app/(tabs)`):

| Route | Tab label | What it does |
|---|---|---|
| `/` (`(pantry)/index.tsx`) | Despensa | The pantry: stock rows with quantity and reorder level. Search, filters (all, restock, out, in stock, on list), grouping (by aisle, by status, none) and sorting (name, quantity, recent). |
| `/item/[id]` | (pushed from Despensa) | One product: stock, quantity controls, and prices per market from pricely.ar. |
| `/scan` (`scan.tsx`) | Escanear | Barcode scanner with three modes: Guardar (add), Usar (use), Consultar (check). The route file is a thin wrapper around `ScanScreen` (see [Web scan](#web-scan)). |
| `/list` (`(list)/list.tsx`) | Lista | Shopping list: add free text or a product, add low-stock items, check items off, put checked items away, clear checked items. |

Sheets (`src/app`, presented as form sheets on native and dialogs on the web):

| Route | Title | What it does |
|---|---|---|
| `/new-product` | Producto nuevo / Producto sin código | Create a product, from a scanned code or without one. |
| `/manual-entry` | Ingresar código | Type a barcode. |
| `/pantry-options` | Agrupar y ordenar | Grouping and sorting for the pantry. |
| `/settings` | Ajustes | Set the API address (Servidor). |

Root layout: `src/app/_layout.tsx` (theme, sheet options). Tab layouts: `src/app/(tabs)/_layout.tsx` (native) and `_layout.web.tsx` (web).

## Project structure

| Path | Contents |
|---|---|
| `src/app` | Routes only. Every file here is a screen, every `_layout.tsx` is a navigator. |
| `src/components` | Shared UI: buttons, cards, fields, sheet, scan controls, stock rows, price list, state views. |
| `src/lib` | Non-UI code: API client (`api.ts`), API address (`server.ts`, `api-host.ts`), storage, alerts, barcode checks, aisles, markets, suggestions, formatting, scan gate. Unit tests sit next to the code. |
| `src/store` | zustand stores: `stock`, `shopping`, `scan`, `insights`, `pantry-view`, `server`. `resource.ts` holds the load status shared by the list stores. |
| `src/theme` | Design tokens (`tokens.ts`), `useTheme`, and the tab bar inset hook. |
| `src/test-utils` | Test factories (`factories.ts`) and the API mock helpers (`mock-api.ts`). |
| `assets/images` | Icons and splash images referenced by `app.json`. The brand source is in `assets/brand` at the repo root. |
| `public` | Web template and PWA files: `index.html`, `manifest.json`, `icons/`. |

## Platform-specific files

Platform differences live in sibling files, not in `Platform.OS` branches. Metro picks the `.web.ts(x)` file for the web build and the plain file for native.

| Web file | Native file | Why |
|---|---|---|
| `src/app/(tabs)/_layout.web.tsx` | `src/app/(tabs)/_layout.tsx` | Native uses `NativeTabs` (system tab bar). The web uses `expo-router/ui` tabs: a bottom bar on narrow windows and a sidebar from 900 px (`SIDEBAR_MIN_WIDTH` in `src/lib/layout.web.ts`). |
| `src/components/sheet.web.tsx` | `src/components/sheet.tsx` | Native routes are already form sheets, so `sheet.tsx` only passes children through. The web version draws a modal dialog over the tabs. |
| `src/lib/alert.web.ts` | `src/lib/alert.ts` | `Alert.alert` does nothing in react-native-web. The web version uses the browser's dialogs. |
| `src/lib/api-host.web.ts` | `src/lib/api-host.ts` | Native guesses the API from the Metro host's LAN IP. The web uses the page's own origin in production and the same host on port 3001 in development. |
| `src/lib/storage.web.ts` | `src/lib/storage.ts` | Native uses expo-sqlite's key-value store. The web uses localStorage, so expo-sqlite (wasm) stays out of the web bundle. |
| `src/lib/feedback.web.ts` | `src/lib/feedback.ts` | Native uses haptics. The web plays short tones per scan outcome and vibrates where the browser allows it. |
| `src/lib/layout.web.ts` | `src/lib/layout.ts` | `useHasSidebar()`: always false on native (tablets keep the header buttons); on the web true from 900 px, where the sidebar replaces the bottom bar. The pantry header hides its settings gear when it is true. |
| `src/components/scan-screen.web.tsx` | `src/components/scan-screen.tsx` | Native is the camera scanner (expo-camera). The web is the keyboard-wedge console. |
| `src/components/stepper-a11y.web.ts` | `src/components/stepper-a11y.ts` | Native exposes the stepper as one adjustable element with increment and decrement actions. The web renders a labelled group with two named buttons ("Menos, ...", "Más, ...") and a live region for the value. |

The scan screens are in `src/components`, not next to the route, on purpose: expo-router bundles every route file, `.web.tsx` siblings included, so a camera import in a route would ship `expo-camera` in the web export. `src/app/(tabs)/scan.tsx` only renders `<ScanScreen />`.

## Web scan

The web has no camera scanner. The Escanear tab (`scan-screen.web.tsx`) is a console with one code field that takes codes from a USB or Bluetooth barcode reader (they type the digits, usually followed by Enter) or typed by hand, with the same modes, session log and Consultar card as the phone. A burst of at least 6 digits typed in a few milliseconds into an empty field submits by itself after a short pause, unless it is one digit repeated (a held key); anything typed by hand waits for Enter (`src/lib/wedge.ts`). The field takes focus when the tab is shown and after a submit, mode change, undo or closed dialog, and printable keys go to it while nothing else is being edited, but it never steals focus from another field, an open dialog, a control reached with the keyboard, or on touch-only devices. The manual-entry sheet keeps focus in its field after Enter on the web too.

## Design tokens

All colors, spacing, radii and type sizes live in `src/theme/tokens.ts`:

- `palette.light` and `palette.dark`: surface, text, accent and status colors. Amber means low stock and red means out of stock.
- `space`, `radius`, `overlay`, `type`, `HIT` (minimum touch target).

Use `useTheme()` (`src/theme/use-theme.ts`) to get the palette for the current color scheme. Do not hard-code colors in screens.

## Testing

Jest uses the `jest-expo` preset (`jest.config.js`):

- Tests are `src/**/*.test.ts(x)`. They sit next to the code under `src/lib` and `src/store`. None live under `src/app`.
- `jest.setup.ts` mocks the native modules that load at import time: expo-sqlite's key-value store, expo-haptics, expo-router (`router.push`) and expo-constants.
- `src/test-utils/mock-api.ts` replaces the `api` object with `jest.fn()` mocks (`mockApiModule`). `deferred()` and `flush()` help control the order of replies.
- `@/` maps to `src/`.

```bash
npm test
```

## Native folders

`ios/` and `android/` are generated (Continuous Native Generation). They are git-ignored (`/ios`, `/android` in `.gitignore`). Do not create or edit them by hand. Change native settings in `app.json` and config plugins.

## What cannot be checked without Xcode or a device

Some behavior can only be checked on a simulator or a real phone:

- iOS and Android builds, including EAS builds.
- Native tab bar and form sheets.
- Camera barcode scanning, haptics, and safe areas on real hardware.
- App icon and splash on each platform.

Jest and the web build cover the logic and the layout on the web. They do not cover the native rendering.
