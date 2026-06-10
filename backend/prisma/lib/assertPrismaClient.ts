import { PrismaClient } from '@prisma/client';

/** 権限 seed に必要な Prisma Client が生成済みか確認する */
export function assertPermissionPrismaClient(prisma: PrismaClient): void {
  const delegate = (prisma as PrismaClient & { permissionResource?: unknown }).permissionResource;
  if (!delegate || typeof (delegate as { findUnique?: unknown }).findUnique !== 'function') {
    throw new Error(
      'Prisma Client に permissionResource がありません。' +
        'サーバーで `npx prisma generate --schema ./prisma/schema.prisma` を実行するか、' +
        '`npm run prisma:seed:permissions:prod` を再実行してください。'
    );
  }
}
