# Alacena API

Express + Prisma backend for the Alacena app. It stores the product catalog, the pantry (stock) and the shopping list in PostgreSQL. For barcodes it asks pricely.ar and Open Food Facts.

There is no authentication yet. The API is meant for one household.

## Stack

- Node 22 (the Dockerfile and CI use `node:22`)
- Express 5, TypeScript
- Prisma 6 with PostgreSQL 16 (`docker-compose.yml`)
- Zod 4 for request validation
- Vitest 5 and supertest for tests

## Scripts

Run from `apps/api`. The root `package.json` has `api:*` aliases for the common ones (see the [root README](../../README.md#root-scripts)).

| Script | What it does | Root alias |
|---|---|---|
| `npm run db:up` | `docker compose up -d db`: start the local PostgreSQL. | `db:up` |
| `npm run migrate:local` | `prisma migrate deploy` with `DATABASE_URL` forced to the local docker database (`localhost:5433/alacena`). | `api:migrate` |
| `npm run dev:local` | Dev server with reload, `DATABASE_URL` forced to the local docker database and `PORT=3001`. The documented way to run locally. | `api:dev` |
| `npm run dev` | Same server (`tsx watch src/index.ts`) with the environment as it is, so it uses whatever `DATABASE_URL` the shell has. | none |
| `npm run build` | Compile TypeScript to `dist/` (`tsc`). | `api:build` |
| `npm start` | Run `node dist/index.js`. Needs a build first. | none |
| `npm run typecheck` | `tsc --noEmit` | `api:typecheck` |
| `npm run lint` | `eslint .` | `api:lint` |
| `npm test` | Vitest, against the test database (see [Testing](#testing)). | `api:test` |
| `npm run prisma:generate` | Generate the Prisma client. | none |
| `npm run prisma:migrate` | `prisma migrate dev`: create and apply a new migration while developing. | none |
| `npm run prisma:studio` | Prisma Studio, a browser UI for the database. | none |

`prisma:migrate` and `prisma:studio` use whatever `DATABASE_URL` the Prisma CLI sees (the shell, or a `.env` file in `apps/api`). Set it to the local database first. Do not run them against a deployed database. Everything else above is safe to run without a `.env`.

## Environment variables

Names and meaning come from `.env.example`. A `.env` is only needed for a real deployment; `dev:local`, `migrate:local` and the tests set their own values. The API process does not load `.env` files itself. Prisma's CLI loads one from `apps/api` when it exists (documented Prisma behaviour; not exercised here because no local script needs it).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | none (required) | PostgreSQL connection string. Local value: `postgresql://alacena:alacena@localhost:5433/alacena?schema=public`. |
| `PORT` | `3001` | Port the server listens on. The server listens on all interfaces, so phones on the same network can reach it. |
| `ALLOWED_ORIGINS` | `http://localhost:8081` | Comma-separated list of browser origins allowed by CORS. Requests without an `Origin` header (native apps) are not affected. Not needed when the web app is served by this same server. |
| `WEB_DIR` | `./public` | Directory with the exported web app (must contain `index.html`). When it exists the API serves it; otherwise only the API runs. Relative to the working directory. |

## Routes

All routes are under `/api`, except `/health`. Any other `/api/...` path answers 404 `{ "error": "No encontrado" }` (never the web app's HTML). Bodies and responses are JSON. The shapes come from `src/serialize.ts`. The app's types depend on them, so change them with care.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check. Returns `{ ok: true }`. |
| POST | `/api/products/resolve` | Body `{ barcode }`. Find a product: local cache, then pricely.ar, then Open Food Facts. Caches the first hit. |
| POST | `/api/products` | Body `{ barcode, name, brand? }`. Create a product by hand. If the barcode already exists, returns the existing product. Responds 201. |
| GET | `/api/products/:id/insights` | Live prices per market (cheapest first) and categories from pricely.ar. Also fills empty description, image, categories and blur hash on the stored product. `prices` is `null` when pricely does not know the product or is down. |
| POST | `/api/products/backfill-categories` | Fetch categories from pricely.ar for up to 40 stored products that have none. Returns `{ updated, remaining }`, or `busy: true` if a run is already in progress. |
| GET | `/api/stock` | The whole pantry, most recently updated first. |
| POST | `/api/stock/add` | Body `{ productId, delta }`. Add `delta` (negative to subtract) to the stock, floored at 0. Returns `{ quantity }`. |
| PATCH | `/api/stock/:id` | Body `{ quantity?, minQty? }`. Set quantity and/or the reorder threshold. |
| DELETE | `/api/stock/:id` | Remove a stock row. Responds 204. |
| GET | `/api/shopping` | The shopping list, oldest first. |
| POST | `/api/shopping` | Body `{ productId }` or `{ name }`, optional `quantity`. A product that is already on the list is returned unchanged (200). A new row responds 201. |
| POST | `/api/shopping/generate` | Add every low or empty product that is not on the list yet. Returns `{ added }`. |
| PATCH | `/api/shopping/:id` | Body `{ quantity?, checked? }`. |
| DELETE | `/api/shopping/checked` | Remove all checked rows. Responds 204. |
| DELETE | `/api/shopping/:id` | Remove one row. Responds 204. |

Route order matters: `DELETE /api/shopping/checked` is registered before `DELETE /api/shopping/:id`.

## Errors

Errors are `{ "error": "<message in Spanish>" }`. The central handler in `src/http.ts` produces them:

| Status | When |
|---|---|
| 400 | Validation failed (first Zod message), invalid JSON, or a shopping item with no name and no product. |
| 404 | Unknown product or row. A foreign-key failure on a product is also reported as 404. |
| 409 | A unique constraint was violated and no route handled it. |
| 413 | Request body too large. |
| 422 | `POST /api/products/resolve`: the barcode is 8, 12 or 13 digits and fails the check digit. |
| 500 | Anything else. The body is `{ "error": "Algo salió mal" }` and the error is logged. |

Exception: `POST /api/products/resolve` is the one non-`{ error }` 404: when it finds nothing it returns 404 with `{ "found": false }` and no `error` field. The app treats any 404 from this route as "not found" and offers manual entry.

## Product lookup

`POST /api/products/resolve` tries three sources in this order:

1. The `products` table (cache, by barcode).
2. pricely.ar (`src/lib/pricely.ts`). This API is undocumented and can change without notice. Every call returns `null` on failure, so the next source runs.
3. Open Food Facts (`src/lib/openFoodFacts.ts`).

Codes with 8, 12 or 13 digits must pass the EAN check digit. Other lengths are not checked.

## Database

Prisma models map to three tables:

| Model | Table | Notes |
|---|---|---|
| `Product` | `products` | One row per barcode. Holds name, brand, image, categories and pricely extras. |
| `StockItem` | `stock_items` | One row per product (`product_id` is unique). Quantity and reorder threshold. |
| `ShoppingItem` | `shopping_list` | Catalog rows are one per product through a partial unique index (`WHERE product_id IS NOT NULL`). That index is written in migration SQL, because Prisma cannot express it. Keep it when you write new migrations. |

Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`.

- Development: `npm run prisma:migrate` creates a migration against the local database; `npm run migrate:local` applies the committed ones.
- Deployment: the image runs `prisma migrate deploy` on every start (see [Deployment](#deployment)).

## Local database

`docker-compose.yml` starts PostgreSQL 16 in a container called `alacena-db`, on host port `5433`, with user, password and database `alacena`. The port is 5433 so it does not clash with a Postgres on 5432.

```bash
npm run db:up        # from apps/api; `npm run db:up` also works from the repo root
```

`docker-compose.yml` also has an `app` profile that builds and runs the API with the web app (see [Deployment](#deployment)). It is off unless you ask for it.

## Testing

`npm test` runs Vitest on `test/**/*.test.ts`. The suite needs the local docker database:

- `vitest.config.ts` sets `DATABASE_URL` to `localhost:5433/alacena_test`, overriding anything in the shell.
- `test/globalSetup.ts` refuses to run unless the URL is `localhost:5433` and the database name ends in `_test`. It creates the test database through `docker exec alacena-db createdb` if it is missing, then runs `prisma migrate deploy`.
- `test/setup.ts` truncates the tables before each test and mocks pricely.ar and Open Food Facts. No test touches the network.

The container must be running (`npm run db:up`).

## Deployment

One Docker image holds the API and the exported web app. The build context is the repository root (the Dockerfile builds the Expo web export from `apps/app` and the API from `apps/api`):

```bash
docker build -f apps/api/Dockerfile -t alacena .
docker run --rm -p 3001:3001 -e DATABASE_URL='<postgres connection string>' alacena
```

Or with compose, which starts the database too (from `apps/api`, using the `app` profile; the database stays on `localhost:5433`):

```bash
docker compose --profile app up -d --build
```

The container:

- runs `prisma migrate deploy` on every start, then `node dist/index.js`;
- listens on `PORT` (default 3001);
- serves the exported web app from `WEB_DIR` (default `./public`, where the image puts it) when `WEB_DIR/index.html` exists: static files, long-lived caching for `_expo/static/*`, no caching for `index.html` and `manifest.json`;
- falls back to `index.html` for unknown GET paths without a file extension, so client-side routes load on a cold visit;
- answers unknown `/api/...` paths with a JSON 404, never HTML.

The web build has no `EXPO_PUBLIC_API_URL`: it talks to its own origin, which is why `ALLOWED_ORIGINS` is not needed for it. Environment: `DATABASE_URL` (required), `PORT`, `ALLOWED_ORIGINS`, `WEB_DIR` (see [Environment variables](#environment-variables)). Use a hosted PostgreSQL connection string in production. `.dockerignore` at the repo root keeps `.env` files, tests, tools and docs out of the build context.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests to `main`. Jobs:

- `changes`: decides what to run. Pushes to `main` always run everything; pull requests run `api` when `apps/api/`, `tools/fixtures/` or the workflow changed, and `app` when `apps/app/`, `tools/fixtures/` or the workflow changed.
- `api`: with a PostgreSQL 16 service on port 5433, in `apps/api`: `npm ci`, `prisma generate`, lint, typecheck, build, tests.
- `app`: in `apps/app`: `npm ci`, `tsc --noEmit`, `expo lint`, `jest --ci`, `expo export --platform web`.
- `image`: only on push to `main`, after `api` and `app` both succeeded. Builds `apps/api/Dockerfile` with the repo root as context and pushes it to GHCR as `latest` and by commit SHA.
