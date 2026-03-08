#!/bin/sh
set -e

echo "Waiting for database..."
while ! nc -z db 5432 2>/dev/null; do
  sleep 1
done
echo "Database is ready."

cd /app/backend

echo "Generating Prisma client..."
npx prisma generate --schema=../prisma/schema.prisma

echo "Syncing database with schema..."
npx prisma db push --schema=../prisma/schema.prisma --accept-data-loss

echo "Seeding database..."
NODE_PATH=/app/backend/node_modules npx tsx ../prisma/seed.ts

echo "Starting server..."
exec npx tsx watch src/index.ts
