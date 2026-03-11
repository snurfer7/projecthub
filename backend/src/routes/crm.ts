import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// ========== Contacts ==========

router.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.query;
    const where = companyId ? { companyId: Number(companyId) } : {};
    const contacts = await prisma.contact.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        details: { include: { location: { select: { id: true, name: true } } } },
        _count: { select: { comments: true } },
      },
      orderBy: { lastName: 'asc' },
    });
    res.json(contacts);
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
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
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
    const contact = await prisma.contact.create({
      data: {
        companyId,
        firstName,
        lastName,
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

    const contact = await prisma.$transaction(async (tx: any) => {
      if (details) {
        await tx.contactDetail.deleteMany({ where: { contactId } });
      }

      return await tx.contact.update({
        where: { id: contactId },
        data: {
          firstName,
          lastName,
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
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
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

router.delete('/deals/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.deal.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '商談を削除しました' });
  } catch {
    res.status(500).json({ error: '商談の削除に失敗しました' });
  }
});

// ========== Activities ==========

router.get('/activities', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, contactId, dealId } = req.query;
    const where: any = {};
    if (companyId) where.companyId = Number(companyId);
    if (contactId) where.contactId = Number(contactId);
    if (dealId) where.dealId = Number(dealId);

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(activities);
  } catch {
    res.status(500).json({ error: '活動の取得に失敗しました' });
  }
});

router.post('/activities', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, contactId, dealId, type, subject, description, dueDate, completed } = req.body;
    const activity = await prisma.activity.create({
      data: {
        companyId, contactId, dealId, userId: req.userId!,
        type, subject, description,
        dueDate: dueDate ? new Date(dueDate) : null,
        completed: completed || false,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(activity);
  } catch {
    res.status(500).json({ error: '活動の作成に失敗しました' });
  }
});

router.put('/activities/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { contactId, dealId, type, subject, description, dueDate, completed } = req.body;
    const activity = await prisma.activity.update({
      where: { id: Number(req.params.id) },
      data: {
        contactId, dealId, type, subject, description,
        dueDate: dueDate ? new Date(dueDate) : null,
        completed,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
      },
    });
    res.json(activity);
  } catch {
    res.status(500).json({ error: '活動の更新に失敗しました' });
  }
});

router.delete('/activities/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.activity.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '活動を削除しました' });
  } catch {
    res.status(500).json({ error: '活動の削除に失敗しました' });
  }
});

export default router;
