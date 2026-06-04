import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/permissions';

const router = Router();
const prisma = new PrismaClient();

function getActivityPersistenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
    return 'DBスキーマが未更新です。マイグレーションを適用してから再実行してください';
  }
  return fallback;
}

/** 活動 API 共通: ファイル用コメントと添付メタ（ダウンロード UI 用） */
const activityInclude = {
  user: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, name: true } },
  fileComment: {
    select: {
      id: true,
      attachments: {
        select: { id: true, filename: true, contentType: true, fileSize: true },
        orderBy: { id: 'asc' as const },
      },
    },
  },
} satisfies Prisma.ActivityInclude;

router.use(authenticateToken);

const contactListInclude = {
  company: { select: { id: true, name: true } },
  details: { include: { location: { select: { id: true, name: true } } } },
  _count: { select: { comments: true } },
} satisfies Prisma.ContactInclude;

function contactSearchWhere(q: string): Prisma.ContactWhereInput {
  const contains = { contains: q, mode: 'insensitive' as const };
  return {
    OR: [
      { lastName: contains },
      { firstName: contains },
      { notes: contains },
      { company: { name: contains } },
      {
        details: {
          some: {
            OR: [
              { department: contains },
              { position: contains },
              { phone: contains },
              { email: contains },
              { location: { name: contains } },
            ],
          },
        },
      },
    ],
  };
}

function buildContactListWhere(companyId: string | undefined, q: string): Prisma.ContactWhereInput {
  const parts: Prisma.ContactWhereInput[] = [];
  if (companyId) {
    parts.push({ companyId: Number(companyId) });
  }
  if (q) {
    parts.push(contactSearchWhere(q));
  }
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

// ========== Contacts ==========

// List contacts: with ?page= — paginated + optional q. Without page — full array (dropdowns, company tab).
router.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.query;
    const pageRaw = req.query.page;
    const usePagination =
      pageRaw !== undefined && pageRaw !== null && String(pageRaw).trim() !== '';

    const where = buildContactListWhere(
      companyId !== undefined && companyId !== null ? String(companyId) : undefined,
      '',
    );

    if (!usePagination) {
      const contacts = await prisma.contact.findMany({
        where,
        include: contactListInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return res.json(contacts);
    }

    const pageParsed = parseInt(String(pageRaw), 10);
    const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
    const sizeParsed = parseInt(String(req.query.pageSize ?? '50'), 10);
    const pageSize = Number.isFinite(sizeParsed) ? Math.min(100, Math.max(1, sizeParsed)) : 50;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const paginatedWhere = buildContactListWhere(
      companyId !== undefined && companyId !== null ? String(companyId) : undefined,
      q,
    );

    const [total, items] = await Promise.all([
      prisma.contact.count({ where: paginatedWhere }),
      prisma.contact.findMany({
        where: paginatedWhere,
        include: contactListInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    return res.json({
      items,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch {
    res.status(500).json({ error: '連絡先の取得に失敗しました' });
  }
});

router.get('/contacts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        company: { select: { id: true, name: true } },
        details: { include: { location: { select: { id: true, name: true } } } },
        deals: { select: { id: true, name: true, status: true, amount: true } },
        activities: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            fileComment: activityInclude.fileComment,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!contact) {
      res.status(404).json({ error: '連絡先が見つかりません' });
      return;
    }
    res.json(contact);
  } catch {
    res.status(500).json({ error: '連絡先の取得に失敗しました' });
  }
});

router.post('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, firstName, lastName, email, phone, position, department, notes, details } = req.body;
    const firstNameNorm = firstName == null ? '' : String(firstName).trim();
    const lastNameNorm = lastName == null ? '' : String(lastName).trim();
    const contact = await prisma.contact.create({
      data: {
        companyId,
        firstName: firstNameNorm,
        lastName: lastNameNorm,
        email,
        phone,
        position,
        department,
        notes,
        details: {
          create: details || [],
        },
      },
      include: { details: true },
    });
    res.status(201).json(contact);
  } catch (e) {
    console.error('Contact creation error:', e);
    res.status(500).json({ error: '連絡先の作成に失敗しました' });
  }
});

router.put('/contacts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, email, phone, position, department, notes, details } = req.body;
    const contactId = Number(req.params.id);
    const firstNameNorm = firstName == null ? '' : String(firstName).trim();
    const lastNameNorm = lastName == null ? '' : String(lastName).trim();

    const contact = await prisma.$transaction(async (tx: any) => {
      if (details) {
        await tx.contactDetail.deleteMany({ where: { contactId } });
      }

      return await tx.contact.update({
        where: { id: contactId },
        data: {
          firstName: firstNameNorm,
          lastName: lastNameNorm,
          email,
          phone,
          position,
          department,
          notes,
          details: details ? {
            create: details,
          } : undefined,
        },
        include: { details: true },
      });
    });
    res.json(contact);
  } catch (e) {
    console.error('Contact update error:', e);
    res.status(500).json({ error: '連絡先の更新に失敗しました' });
  }
});

router.delete('/contacts/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.contact.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '連絡先を削除しました' });
  } catch {
    res.status(500).json({ error: '連絡先の削除に失敗しました' });
  }
});

// ========== Contact Comments ==========

router.get('/contacts/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const comments = await prisma.contactComment.findMany({
      where: { contactId: Number(req.params.id) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch {
    res.status(500).json({ error: 'コメントの取得に失敗しました' });
  }
});

router.post('/contacts/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.contactComment.create({
      data: {
        contactId: Number(req.params.id),
        userId: req.userId!,
        content: req.body.content,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: 'コメントの作成に失敗しました' });
  }
});

router.put('/contacts/:id/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const { content } = req.body;

    const existing = await prisma.contactComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }

    if (existing.userId !== req.userId && !req.isAdmin) {
      res.status(403).json({ error: '編集権限がありません' });
      return;
    }

    const comment = await prisma.contactComment.update({
      where: { id: commentId },
      data: { content },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(comment);
  } catch {
    res.status(500).json({ error: 'コメントの更新に失敗しました' });
  }
});

router.delete('/contacts/:id/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.contactComment.findUnique({
      where: { id: Number(req.params.commentId) },
    });
    if (!comment) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }
    if (comment.userId !== req.userId && !req.isAdmin) {
      res.status(403).json({ error: '削除権限がありません' });
      return;
    }
    await prisma.contactComment.delete({ where: { id: Number(req.params.commentId) } });
    res.json({ message: 'コメントを削除しました' });
  } catch {
    res.status(500).json({ error: 'コメントの削除に失敗しました' });
  }
});

// ========== Deals ==========

router.get('/deals', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, status, assignedToId } = req.query;
    const where: any = {};
    if (companyId) where.companyId = Number(companyId);
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = Number(assignedToId);

    const deals = await prisma.deal.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(deals);
  } catch {
    res.status(500).json({ error: '商談の取得に失敗しました' });
  }
});

router.get('/deals/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        activities: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            fileComment: activityInclude.fileComment,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!deal) {
      res.status(404).json({ error: '商談が見つかりません' });
      return;
    }
    res.json(deal);
  } catch {
    res.status(500).json({ error: '商談の取得に失敗しました' });
  }
});

router.post('/deals', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, contactId, name, amount, status, probability, expectedCloseDate, assignedToId, notes } = req.body;
    if (assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: Number(assignedToId) } });
      if (user && (user.status === 'pending' || user.status === 'inactive')) {
        return res.status(400).json({ error: '選択されたユーザー（仮登録または退職）は担当者に指定できません' });
      }
    }

    const deal = await prisma.deal.create({
      data: {
        companyId, contactId, name, amount, status, probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assignedToId, notes,
      },
    });
    res.status(201).json(deal);
  } catch {
    res.status(500).json({ error: '商談の作成に失敗しました' });
  }
});

router.put('/deals/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { contactId, name, amount, status, probability, expectedCloseDate, assignedToId, notes } = req.body;
    if (assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: Number(assignedToId) } });
      if (user && (user.status === 'pending' || user.status === 'inactive')) {
        return res.status(400).json({ error: '選択されたユーザー（仮登録または退職）は担当者に指定できません' });
      }
    }

    const deal = await prisma.deal.update({
      where: { id: Number(req.params.id) },
      data: {
        contactId, name, amount, status, probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assignedToId, notes,
      },
    });
    res.json(deal);
  } catch {
    res.status(500).json({ error: '商談の更新に失敗しました' });
  }
});

router.delete('/deals/:id', requirePermission('companies.deals', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.deal.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '商談を削除しました' });
  } catch {
    res.status(500).json({ error: '商談の削除に失敗しました' });
  }
});

// ========== Activities ==========

router.get('/activities', requirePermission('companies.activities', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, contactId, dealId } = req.query;
    const where: any = {};
    if (companyId) where.companyId = Number(companyId);
    if (contactId) where.contactId = Number(contactId);
    if (dealId) where.dealId = Number(dealId);

    const activities = await prisma.activity.findMany({
      where,
      include: activityInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(activities);
  } catch (e) {
    console.error('Activity fetch error:', e);
    res.status(500).json({ error: getActivityPersistenceErrorMessage(e, '活動の取得に失敗しました') });
  }
});

router.post('/activities', requirePermission('companies.activities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, contactId, dealId, assignedToId, type, subject, description, dueDate, completed } = req.body;
    if (assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: Number(assignedToId) } });
      if (user && (user.status === 'pending' || user.status === 'inactive')) {
        return res.status(400).json({ error: '選択されたユーザー（仮登録または退職）は自社担当者に指定できません' });
      }
    }

    const activity = await prisma.activity.create({
      data: {
        companyId, contactId, dealId, userId: req.userId!,
        assignedToId,
        type, subject, description,
        dueDate: dueDate ? new Date(dueDate) : null,
        completed: completed || false,
      },
      include: activityInclude,
    });
    res.status(201).json(activity);
  } catch (e) {
    console.error('Activity create error:', e);
    res.status(500).json({ error: getActivityPersistenceErrorMessage(e, '活動の作成に失敗しました') });
  }
});

router.put('/activities/:id', requirePermission('companies.activities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { contactId, dealId, assignedToId, type, subject, description, dueDate, completed } = req.body;
    if (assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: Number(assignedToId) } });
      if (user && (user.status === 'pending' || user.status === 'inactive')) {
        return res.status(400).json({ error: '選択されたユーザー（仮登録または退職）は自社担当者に指定できません' });
      }
    }

    const activity = await prisma.activity.update({
      where: { id: Number(req.params.id) },
      data: {
        contactId, dealId, assignedToId, type, subject, description,
        dueDate: dueDate ? new Date(dueDate) : null,
        completed,
      },
      include: activityInclude,
    });
    res.json(activity);
  } catch (e) {
    console.error('Activity update error:', e);
    res.status(500).json({ error: getActivityPersistenceErrorMessage(e, '活動の更新に失敗しました') });
  }
});

router.delete('/activities/:id', requirePermission('companies.activities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Number(req.params.id);
    const raw = req.query.deleteLinkedComment;
    const deleteLinkedComment = raw === 'true' || raw === '1';

    const existing = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, fileCommentId: true },
    });
    if (!existing) {
      res.status(404).json({ error: '活動が見つかりません' });
      return;
    }

    const fileCommentId = existing.fileCommentId;

    await prisma.activity.delete({ where: { id: activityId } });

    if (deleteLinkedComment && fileCommentId != null) {
      try {
        await prisma.companyComment.delete({ where: { id: fileCommentId } });
      } catch {
        // 既に削除済みなど
      }
    }

    res.json({ message: '活動を削除しました' });
  } catch (e) {
    console.error('Activity delete error:', e);
    res.status(500).json({ error: '活動の削除に失敗しました' });
  }
});

export default router;
