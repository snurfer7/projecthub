FROM node:20.20.1-slim

RUN apt-get update && apt-get install -y --no-install-recommends netcat-traditional tzdata && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
COPY prisma ./prisma/
COPY backend ./backend/

WORKDIR /app/backend
RUN npm install

# Generate Prisma Client
RUN npx prisma generate --schema=../prisma/schema.prisma

RUN chmod +x /app/backend/start.sh

EXPOSE 3000

CMD ["/app/backend/start.sh"]
