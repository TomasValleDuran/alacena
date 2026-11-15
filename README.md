# Alacena

Alacena tracks what is in your pantry and what you still need to buy. You scan groceries in and out, keep a shopping list, and compare prices across Argentine supermarkets.

It can:

- Show the pantry with stock levels, grouped by aisle, status or nothing, with search and filters (all, restock, out, in stock, on list).
- Scan barcodes in three modes: Guardar (add to the pantry), Usar (take out), Consultar (check how much is left).
- Keep a shopping list: add items by name or product, add low-stock items in one step, check items off, put checked items away, clear them.
- Compare prices per market for the supermarkets the household uses, cheapest first.
- Run on iOS, Android and the web from one codebase.
- Take codes from a USB barcode reader on the web. <!-- VERIFY: web scan screen (scan.web.tsx) is in progress; not in this worktree yet. -->

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

### 1. Start the database

```bash
cd apps/api
docker compose up -d
```

This starts PostgreSQL 16 in a container named `alacena-db` on port 5433.

### 2. Run the API

```bash
cd apps/api
cp .env.example .env     # DATABASE_URL points at the local container
npm ci
npm run prisma:migrate   # apply migrations to the local database
npm run dev:local        # API on http://localhost:3001, reloads on change
```

Check it with `curl http://localhost:3001/health`. `dev:local` forces `DATABASE_URL` to the local container, whatever the shell or `.env` says.

### 3. Run the app

```bash
cd apps/app
npm ci
npm run web              # opens the web app
```

On a phone, run `npm start` and open the project in Expo Go or a development build. Phone and computer must be on the same network. The app finds the API on port 3001 of the computer that runs Metro. <!-- VERIFY: Expo Go is enough for this app, or a development build is needed; not checked against the native module list here. -->

The same commands are available from the root: `npm run app:web`, `npm run app:start`, `npm run app:ios`, `npm run app:android`, `npm run api:build`, `npm run api:start`, `npm run api:prisma:migrate`, `npm run api:prisma:studio`, `npm run import:barcodes`. The root has no alias for `dev:local`. Use `npm --prefix apps/api run dev:local`.

## Running checks

API (`apps/api`):

```bash
npm run lint
npm run typecheck
npm run build
npm test           # needs the docker database running
```

App (`apps/app`):

```bash
npm run lint       # expo lint
npx tsc --noEmit   # typecheck (no npm script)
npm test           # jest
```

## How the app finds the API

The app picks the API address in this order:

1. The address saved in Ajustes, in the "Servidor" section. It is stored on the device.
2. The `EXPO_PUBLIC_API_URL` environment variable, read when Expo bundles the app.
3. An automatic guess. On a phone: the LAN address of the Metro dev server, port 3001. On the web: the page's own origin in production, and the same host on port 3001 in development.

## Deployment

The API is packaged as one Docker image that also serves the exported web app. On start it applies database migrations. It needs `DATABASE_URL`, `PORT` and `ALLOWED_ORIGINS`. <!-- VERIFY: single-container deployment (WEB_DIR, migrate on start, repo-root build context) is in progress; not in this worktree yet. --> See [apps/api/README.md](apps/api/README.md#deployment).

## More documentation

- [apps/app/README.md](apps/app/README.md): app stack, screens, structure, testing
- [apps/api/README.md](apps/api/README.md): API scripts, environment, routes, database, testing, deployment
- [AGENTS.md](AGENTS.md): rules for coding agents working in this repo
- [tools/import-barcodes/README.md](tools/import-barcodes/README.md): bulk barcode import
- [tools/pricely-mirror/README.md](tools/pricely-mirror/README.md): pricely.ar backup tool
- [assets/brand/README.md](assets/brand/README.md): icon and splash assets
