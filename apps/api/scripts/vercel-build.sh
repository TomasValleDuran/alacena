#!/bin/sh
# Vercel build for the API project (see vercel.json).
# Production deploys apply pending migrations BEFORE the new code goes live;
# preview deploys never touch the schema. prisma migrate needs a direct
# (non-pooled) Neon connection, so DIRECT_DATABASE_URL is preferred when set.
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}" npx prisma migrate deploy
fi
npm run build
