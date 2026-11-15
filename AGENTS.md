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
| `.github/workflows/ci.yml` | CI. Builds the API only. | |

There are no npm workspaces. Each app has its own `package.json` and lockfile. Run commands with `npm --prefix apps/<name>` from the root, or `cd` into the folder.

## Before you call work done

Run the checks for the app you changed.

API (`apps/api`):

```bash
npm run lint
npm run typecheck
npm run build
npm test           # needs the local docker database, see below
```

App (`apps/app`):

```bash
npm run lint       # expo lint
npx tsc --noEmit   # no npm script for this
npm test           # jest
```

Run lint and typecheck before you declare any task done.

## Database safety

- Tests and local runs use the docker Postgres on `localhost:5433` (`docker compose up -d` in `apps/api`).
- The API tests only accept `localhost:5433/*_test`. Do not work around that guard.
- Never point tests, migrations, Prisma Studio or any script at a deployed database.
- `npm run prisma:migrate` and `prisma:studio` use `DATABASE_URL` from the shell or `apps/api/.env`. Check it points at localhost before you run them.
- Never read, print or commit `.env` files. Only `.env.example` files belong in git.

## One UI codebase for all platforms

- The app runs on iOS, Android and the web from one codebase. Every change must work on all three.
- Prefer `*.web.tsx` (or `*.web.ts`) sibling files over `Platform.OS` branches. A few `process.env.EXPO_OS` checks exist for small differences; do not add more without need.
- `Alert.alert` does nothing on the web. Use `src/lib/alert` (it picks `alert.web.ts` on the web).
- `accessibilityState` does not reach the web. <!-- VERIFY: react-native-web behavior for accessibilityState; node_modules is not installed in this worktree, so this could not be checked. --> On the web, set `aria-*` props (for example `aria-selected`, `aria-disabled`, `aria-busy`) and keep `accessibilityState` for native.
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
- For Expo packages, use `npx expo install <package>`, not `npm install`. It picks the versions for the installed SDK.
- Prefer a recommended Expo module over a third-party library.

## Expo app rules (`apps/app`)

These are the Expo rules from `apps/app/AGENTS.md`, kept in one place here:

- Expo changes every SDK release. Read the `expo` major version in `apps/app/package.json`, then read the matching docs at `https://docs.expo.dev/versions/v<major>.0.0/`. For anything else, use `https://docs.expo.dev/llms.txt` and follow its links. Never answer Expo API questions from memory.
- Use Expo Router for all navigation. Routes live only in `apps/app/src/app/`. Keep components, hooks and utils outside `src/app/`.
- `ios/` and `android/` are generated and git-ignored. Never create or edit them by hand. Configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, you need a development build (`npx expo run:ios|android`, or `eas build --profile development`).
- Builds and updates go through EAS (`eas build`, `eas submit`, `eas update`). Details are in `apps/app/AGENTS.md`.
