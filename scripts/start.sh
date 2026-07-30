#!/bin/sh
set -e

echo "Waiting for database..."
while ! nc -z db 5432 2>/dev/null; do
  sleep 1
done
echo "Database is ready."

cd /app/backend

# seed / migrate の前に Client を必ず生成（イメージ内の古い Client を上書き）
echo "Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

echo "Syncing database with migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Seeding database..."
NODE_PATH=/app/backend/node_modules npx tsx ./prisma/seed.ts

echo "Starting server (schema.prisma 変更時は Prisma Client を自動再生成)..."
if [ -f ./dev-server.mjs ]; then
  exec node ./dev-server.mjs
fi
if [ -f /app/scripts/dev-server.mjs ]; then
  exec node /app/scripts/dev-server.mjs
fi

exec npx tsx watch src/index.ts
