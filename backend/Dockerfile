FROM node:20-alpine

RUN apk add --no-cache netcat-openbsd

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
