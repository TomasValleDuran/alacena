# syntax=docker/dockerfile:1

# ---- base ----------------------------------------------------------------
# Prisma's query engine needs openssl present at build & run time.
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# ---- build: full deps, generate Prisma client, compile TS -----------------
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- prod-deps: production-only node_modules ------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runner: minimal runtime image ---------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# prod dependencies, plus the Prisma client generated in the build stage
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
