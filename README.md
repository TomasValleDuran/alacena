# Alacena

Alacena tracks what is in your pantry and what you still need to buy. You scan groceries in and out, keep a shopping list, and compare prices across Argentine supermarkets.

It can:

- Show the pantry with stock levels, grouped by aisle, status or nothing, with search and filters (all, restock, out, in stock, on list).
- Scan barcodes in three modes: Guardar (add to the pantry), Usar (take out), Consultar (check how much is left).
- Keep a shopping list: add items by name or product, add low-stock items in one step, check items off, put checked items away, clear them.
- Compare prices per market for the supermarkets the household uses, cheapest first.
- Run on iOS, Android and the web from one codebase.
- Take codes from a USB barcode reader (or typed) on the web, where there is no camera scanner.

The project was consolidated from three repositories in November 2026.

## Repository layout

```
apps/app            Expo app (iOS, Android, web)
apps/api            Express + Prisma API, PostgreSQL
tools/import-barcodes   Bulk-add barcodes to the catalog through the API
tools/pricely-mirror    One-time backup of the pricely.ar catalog (Python)
tools/fixtures          Barcode test vectors used by the app tests
assets/brand            Icon and splash sources
```

## Prerequisites

- Node 22. The API's Dockerfile and CI use Node 22.
- npm. Each app has its own `package.json` and lockfile. There are no workspaces.
- Docker with Compose, for the local PostgreSQL database.
- For simulators or emulators: Xcode (iOS) or Android Studio (Android). Phones and the web need neither.

## Quick start

Local runs never need a `.env` file. `.env` is only for a real deployment; the local scripts below force the local docker database themselves, whatever `DATABASE_URL` the shell has.

```bash
(cd apps/api && npm ci)
(cd apps/app && npm ci)

npm run db:up         # PostgreSQL 16 in the container alacena-db, port 5433
npm run api:migrate   # apply the committed migrations to the local database
npm run api:dev       # API on http://localhost:3001, reloads on change
npm run app:web       # in a second terminal: the web app (Expo, usually http://localhost:8081)
```

Check the API with `curl http://localhost:3001/health`.

On a phone, run `npm run app:start` and open the project on the device. Phone and computer must be on the same network. The app finds the API on port 3001 of the computer that runs Metro.

**Expo Go or a development build?** Use a development build (`npm run app:ios` / `npm run app:android`, or `eas build --profile development`). The reason: the native modules the app uses (expo-camera, expo-sqlite, reanimated 4.7.1 with react-native-worklets 0.13.0) are listed as included in Expo Go in the SDK 58 docs, but the native settings in `app.json` (plain-HTTP access to the API on the local network through `usesCleartextTraffic` and `NSAllowsLocalNetworking`, the camera permission text) only take effect in a binary built from this project, and I could not confirm from the docs that Expo Go allows that traffic on its own. Expo Go may work for a quick look; it is not verified.

### Root scripts

| Script | What it does |
|---|---|
| `npm run db:up` | Start the local PostgreSQL container |
| `npm run api:dev` | API with reload against the local database (`dev:local`) |
| `npm run api:migrate` | Apply migrations to the local database (`migrate:local`) |
| `npm run api:test`, `api:lint`, `api:typecheck`, `api:build` | API checks and build |
| `npm run app:start`, `app:web`, `app:ios`, `app:android` | Expo dev server (all, web, iOS, Android) |
| `npm run app:test`, `app:lint`, `app:typecheck` | App checks |
| `npm run import:barcodes` | Bulk barcode import through the API (see its README) |
| `npm run check` | Lint, typecheck, build and tests for both apps, in sequence |

## Running checks

`npm run check` from the root runs everything below (the API tests need `npm run db:up` first). Per app:

```bash
npm run api:lint && npm run api:typecheck && npm run api:build && npm run api:test
npm run app:lint && npm run app:typecheck && npm run app:test
```

## How the app finds the API

The app picks the API address in this order:

1. The address saved in Ajustes, in the "Servidor" section. It is stored on the device.
2. The `EXPO_PUBLIC_API_URL` environment variable, read when Expo bundles the app.
3. An automatic guess. On a phone: the LAN address of the Metro dev server, port 3001. On the web: the page's own origin in production, and the same host on port 3001 in development.

## Deployment

The API is packaged as one Docker image that also serves the exported web app. On start it applies database migrations. It needs `DATABASE_URL`; `PORT`, `ALLOWED_ORIGINS` and `WEB_DIR` are optional. Build it from the repository root with `docker build -f apps/api/Dockerfile .`. See [apps/api/README.md](apps/api/README.md#deployment).

## More documentation

- [apps/app/README.md](apps/app/README.md): app stack, screens, structure, testing
- [apps/api/README.md](apps/api/README.md): API scripts, environment, routes, database, testing, deployment
- [AGENTS.md](AGENTS.md): rules for coding agents working in this repo
- [tools/import-barcodes/README.md](tools/import-barcodes/README.md): bulk barcode import
- [tools/pricely-mirror/README.md](tools/pricely-mirror/README.md): pricely.ar backup tool
- [assets/brand/README.md](assets/brand/README.md): icon and splash assets
