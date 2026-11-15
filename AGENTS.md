# Instructions for coding agents

Alacena is a home pantry tracker: scan groceries in and out, keep a shopping list, compare prices across Argentine supermarkets. Read the [root README](README.md) for an overview.

## Layout

| Path | What it is | Read first |
|---|---|---|
| `apps/app` | Expo app for iOS, Android and the web | `apps/app/README.md`, `apps/app/AGENTS.md` |
| `apps/api` | Express and Prisma API, PostgreSQL | `apps/api/README.md` |
| `tools/import-barcodes` | Bulk barcode import through the API | its README |
| `tools/pricely-mirror` | One-time pricely.ar backup (Python) | its README |
| `tools/fixtures` | Barcode test vectors used by the app tests | `barcodes.json` |
| `assets/brand` | Icon and splash sources | `assets/brand/README.md` |
| `.github/workflows/ci.yml` | CI: `changes`, `api`, `app` and `image` jobs | `apps/api/README.md#ci` |

There are no npm workspaces. Each app has its own `package.json` and lockfile (`npm ci` in each). Use the root scripts below, or `cd` into the app.

## Commands

Run these from the repo root. None of them needs a `.env`.

| Command | What it does |
|---|---|
| `npm run db:up` | Start the local PostgreSQL (docker `alacena-db`, port 5433) |
| `npm run api:migrate` | Apply migrations to the local database |
| `npm run api:dev` | API on :3001 against the local database |
| `npm run app:web` / `app:start` / `app:ios` / `app:android` | Expo dev server |
| `npm run api:lint` `api:typecheck` `api:build` `api:test` | API checks (tests need `db:up`) |
| `npm run app:lint` `app:typecheck` `app:test` | App checks |
| `npm run import:barcodes` | Bulk barcode import |
| `npm run check` | Every check above, for both apps, in sequence |

## Before you call work done

Run `npm run check`, or at least the checks for the app you changed. Lint and typecheck are required before you declare any task done. For web-visible changes also run `npx expo export --platform web` in `apps/app`.

## Database safety

- Tests and local runs use the docker Postgres on `localhost:5433`. The root scripts `api:dev` and `api:migrate` force that database. Do not use or document the plain `npm run dev` in `apps/api` as the normal path: it uses the shell's `DATABASE_URL`.
- The API tests only accept `localhost:5433/*_test`. Do not work around that guard.
- Never point tests, migrations, Prisma Studio or any script at a deployed database. `prisma:migrate` and `prisma:studio` (in `apps/api`) use `DATABASE_URL` from the shell or `apps/api/.env`: check it points at localhost first.
- Never create, read, print or commit `.env` files. Only `.env.example` files belong in git. A `.env` is for a real deployment only.

## One UI codebase for all platforms

- The app runs on iOS, Android and the web from one codebase. Every change must work on all three.
- Prefer `*.web.tsx` (or `*.web.ts`) sibling files over `Platform.OS` branches. A few `process.env.EXPO_OS` checks exist for small differences; do not add more without need.
- Never import platform-specific code in a route file under `src/app`: expo-router bundles every route file, `.web.tsx` siblings included. Keep platform screens in `src/components` (`scan-screen.tsx` and `scan-screen.web.tsx`) and render them from one thin route, or `expo-camera` ends up in the web export.
- `Alert.alert` does nothing on the web. Use `src/lib/alert` (it picks `alert.web.ts` on the web).
- `accessibilityState` does not reach the web (react-native-web 0.21 does not map it to DOM attributes). On the web, set `aria-*` props (for example `aria-selected`, `aria-disabled`, `aria-busy`) and keep `accessibilityState` for native.
- Test the web layout and the native behavior separately. Jest covers logic, not native rendering.

## Copy

- UI copy is Argentine Spanish, with voseo (`Escaneá`, `Guardás`, `Consultar`).
- Copy is device-neutral. Do not name a device or an input method (no "con el teléfono", "hacé clic", "deslizá").
- Keep the product's existing term for each concept. The modes are Guardar, Usar and Consultar. The tabs are Despensa, Escanear and Lista.

## API contract

- Responses keep the shapes in `apps/api/src/serialize.ts`. The app's wire types depend on them. Change a shape only together with the app's types in `apps/app/src/lib/types.ts`.
- Errors are `{ error: string }`, with the exception of `POST /api/products/resolve`, which returns `{ found: false }` on 404. See `apps/api/README.md`.

## Keep it small

- No new layers, abstractions, or dependencies without a clear need.

## Expo app rules

The Expo-specific rules (docs lookup, Expo Router, generated native folders, Expo Go versus development builds, EAS) are in [apps/app/AGENTS.md](apps/app/AGENTS.md). Read it before you touch `apps/app`. Add Expo packages with `npx expo install <package>`, never `npm install`.
