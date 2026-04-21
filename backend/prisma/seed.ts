import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ensure admin user exists
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash,
        firstName: '管理者',
        lastName: 'Admin',
        role: 'admin',
        isAdmin: true,
      },
    });
    console.log('Admin user created');
  }

  // roles
  const roleCount = await prisma.role.count();
  if (roleCount === 0) {
    await prisma.role.createMany({
      data: [
        { name: '管理者', position: 0, isDefaultRole: true },
        { name: 'メンバー', position: 1 },
      ],
    });
    console.log('Seeded default roles');
  }

  // only create trackers if none exist

  const trackerCount = await prisma.tracker.count();
  if (trackerCount === 0) {
    await prisma.tracker.createMany({
      data: [
        { name: 'バグ', position: 1 },
        { name: '機能', position: 2 },
        { name: 'タスク', position: 3 },
        { name: 'サポート', position: 4 },
      ],
    });
    console.log('Seeded default trackers');
  }

  // statuses
  const statusCount = await prisma.issueStatus.count();
  if (statusCount === 0) {
    await prisma.issueStatus.createMany({
      data: [
        { name: '新規', position: 1 },
        { name: '進行中', position: 2 },
        { name: '解決', position: 3 },
        { name: 'フィードバック', position: 4 },
        { name: '終了', isClosed: true, position: 5 },
        { name: '却下', isClosed: true, position: 6 },
      ],
    });
    console.log('Seeded default statuses');
  }

  // priorities
  const priorityCount = await prisma.issuePriority.count();
  if (priorityCount === 0) {
    await prisma.issuePriority.createMany({
      data: [
        { name: '低め', position: 1 },
        { name: '通常', position: 2 },
        { name: '高め', position: 3 },
        { name: '急いで', position: 4 },
        { name: '今すぐ', position: 5 },
      ],
    });
    console.log('Seeded default priorities');
  }

  // legal entity statuses
  const legalEntityStatusCount = await prisma.legalEntityStatus.count();
  if (legalEntityStatusCount === 0) {
    await prisma.legalEntityStatus.createMany({
      data: [
        { name: '株式会社', position: 1 },
        { name: '合同会社', position: 2 },
        { name: '合名会社', position: 3 },
        { name: '合資会社', position: 4 },
        { name: '有限会社', position: 5 },
      ],
    });
    console.log('Seeded default legal entity statuses');
  }

  console.log('Seed data check complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
