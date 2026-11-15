# syntax=docker/dockerfile:1
#
# Single-container deployment: the API also serves the exported web app.
# The build context is the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t alacena .

# ---- web: static export of the Expo app ------------------------------------
FROM node:22-slim AS web
WORKDIR /web
ENV CI=1 EXPO_NO_TELEMETRY=1
COPY apps/app/package.json apps/app/package-lock.json ./
RUN npm ci
COPY apps/app/app.json apps/app/tsconfig.json ./
COPY apps/app/assets ./assets
COPY apps/app/public ./public
COPY apps/app/src ./src
# No EXPO_PUBLIC_API_URL: the production web build talks to location.origin.
RUN npx expo export --platform web

# ---- base ----------------------------------------------------------------
# Prisma's query engine needs openssl present at build & run time.
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# ---- build: full deps, generate Prisma client, compile TS -----------------
FROM base AS build
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci
COPY apps/api/prisma ./prisma
RUN npx prisma generate
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build

# ---- prod-deps: production-only node_modules ------------------------------
FROM base AS prod-deps
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev

# ---- runner: minimal runtime image ---------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# prod dependencies, plus the Prisma client generated in the build stage
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
COPY --from=web /web/dist ./public
EXPOSE 3001
USER node
# `exec` so node is PID 1 and receives SIGTERM directly (fast `docker stop`).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/index.js"]
