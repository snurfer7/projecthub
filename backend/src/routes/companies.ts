import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/permissions';

const router = Router();
const prisma = new PrismaClient();

function companyCommentPersistenceMessage(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2022') {
      return 'DBスキーマが未更新です。マイグレーションを適用してから再実行してください';
    }
    if (error.code === 'P2003') {
      return '関連データの参照が無効です（ユーザーまたは企業の整合性を確認してください）';
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return '送信データの形式が不正です。再ログインするかページを再読み込みしてお試しください';
  }
  if (process.env.NODE_ENV === 'development' && error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

router.use(authenticateToken);

const companyListInclude = {
  legalEntityStatus: true,
  locations: true,
  _count: { select: { projects: true, wikiPages: true, comments: true, locations: true } },
} satisfies Prisma.CompanyInclude;

function companySearchWhere(q: string): Prisma.CompanyWhereInput {
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      {
        locations: {
          some: {
            OR: [
              { phone: { contains: q, mode: 'insensitive' } },
              { fax: { contains: q, mode: 'insensitive' } },
              { postalCode: { contains: q, mode: 'insensitive' } },
              { prefecture: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { street: { contains: q, mode: 'insensitive' } },
              { building: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ],
  };
}

// List companies: with ?page= — paginated + optional q. Without page — full array (dropdowns).
router.get('/', requirePermission('companies', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const pageRaw = req.query.page;
    const usePagination =
      pageRaw !== undefined && pageRaw !== null && String(pageRaw).trim() !== '';

    if (!usePagination) {
      const companies = await prisma.company.findMany({
        include: {
          legalEntityStatus: true,
          locations: true,
          contacts: true,
          _count: { select: { projects: true, wikiPages: true, comments: true, locations: true } },
        },
        orderBy: { name: 'asc' },
      });
      return res.json(companies);
    }

    const pageParsed = parseInt(String(pageRaw), 10);
    const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;
    const sizeParsed = parseInt(String(req.query.pageSize ?? '50'), 10);
    const pageSize = Number.isFinite(sizeParsed) ? Math.min(100, Math.max(1, sizeParsed)) : 50;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where: Prisma.CompanyWhereInput = q ? companySearchWhere(q) : {};

    const [total, items] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        include: companyListInclude,
        orderBy: { name: 'asc' },
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
  } catch (e) {
    console.error('companies.getCompanies error:', e);
    res.status(500).json({ error: '企業の取得に失敗しました' });
  }
});

// Get company details with associations
router.get('/:id', requirePermission('companies', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        legalEntityStatus: true,
        projects: { select: { id: true, name: true, identifier: true, status: true } },
        associations: {
          include: { association: true },
          orderBy: { createdAt: 'desc' },
        },
        locations: true,
        _count: {
          select: { comments: true, wikiPages: true, projects: true, locations: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: '企業が見つかりません' });
    }

    res.json(company);
  } catch (e) {
    console.error('companies.getCompanyDetail error:', e);
    res.status(500).json({ error: '企業の取得に失敗しました' });
  }
});

function companyCreateErrorMessage(error: unknown, fallback: string): { status: number; message: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const fields = (error.meta as { target?: string[] } | undefined)?.target;
      const isNameUnique =
        Array.isArray(fields) && fields.some((f) => f === 'name' || f === 'companies_name_key');
      return {
        status: 409,
        message: isNameUnique ? '同じ企業名が既に登録されています' : '一意制約に違反するデータです',
      };
    }
    if (error.code === 'P2003') {
      return {
        status: 400,
        message: '法人格の指定が無効です。マスタを確認するか、法人格を空にしてお試しください',
      };
    }
    if (error.code === 'P2022') {
      return {
        status: 500,
        message: 'DBスキーマが未更新です。マイグレーションを適用してから再実行してください',
      };
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: '送信データの形式が不正です' };
  }
  if (process.env.NODE_ENV === 'development' && error instanceof Error && error.message) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: fallback };
}

// Create company
router.post('/', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, legalEntityStatusId, legalEntityPosition, postalCode, prefecture, city, street, building, phone, fax, website, notes, latitude, longitude } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: '企業名は必須です' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: name.trim(),
          legalEntityStatus: legalEntityStatusId ? { connect: { id: Number(legalEntityStatusId) } } : undefined,
          legalEntityPosition,
          website,
          notes,
        },
      });

      // 拠点（本社）の初期登録
      await tx.location.create({
        data: {
          companyId: company.id,
          name: '本社',
          phone,
          fax,
          postalCode,
          prefecture,
          city,
          street,
          building,
          isProfileDisplay: true,
          latitude: latitude != null && latitude !== '' ? Number(latitude) : null,
          longitude: longitude != null && longitude !== '' ? Number(longitude) : null,
        },
      });

      return company;
    });

    res.status(201).json(result);
  } catch (e) {
    console.error('companies.createCompany error:', e);
    const { status, message } = companyCreateErrorMessage(e, '企業の作成に失敗しました');
    res.status(status).json({ error: message });
  }
});

// Update company
router.put('/:id', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, legalEntityStatusId, legalEntityPosition, postalCode, prefecture, city, street, building, phone, fax, website, notes, latitude, longitude } = req.body;
    const companyId = Number(req.params.id);
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        legalEntityStatus: legalEntityStatusId ? { connect: { id: Number(legalEntityStatusId) } } : { disconnect: true },
        legalEntityPosition,
        website,
        notes,
      },
    });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: '企業の更新に失敗しました' });
  }
});

// Delete company
router.delete('/:id', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.company.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '企業を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '企業の削除に失敗しました' });
  }
});

// Merge source company (:id) into target — reassign all company_id FKs, delete source
router.post('/:id/merge', requirePermission('companies.merge', 'input'), async (req: AuthRequest, res: Response) => {
  const sourceId = Number(req.params.id);
  const rawTarget = (req.body || {}) as { targetCompanyId?: number | string };
  const targetId = Number(rawTarget.targetCompanyId);

  if (!Number.isFinite(sourceId) || sourceId < 1) {
    return res.status(400).json({ error: '統合元の企業 ID が不正です' });
  }
  if (!Number.isFinite(targetId) || targetId < 1) {
    return res.status(400).json({ error: '統合先の企業 ID（targetCompanyId）が必要です' });
  }
  if (sourceId === targetId) {
    return res.status(400).json({ error: '統合元と統合先に同じ企業は指定できません' });
  }

  try {
    const [source, target] = await Promise.all([
      prisma.company.findUnique({ where: { id: sourceId } }),
      prisma.company.findUnique({ where: { id: targetId } }),
    ]);
    if (!source) {
      return res.status(404).json({ error: '統合元の企業が見つかりません' });
    }
    if (!target) {
      return res.status(404).json({ error: '統合先の企業が見つかりません' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const targetTitleRows = await tx.companyWikiPage.findMany({
        where: { companyId: targetId },
        select: { title: true },
      });
      const targetTitles = new Set(targetTitleRows.map((r) => r.title));

      const sourcePages = await tx.companyWikiPage.findMany({
        where: { companyId: sourceId },
        select: { id: true, title: true },
      });
      for (const page of sourcePages) {
        if (targetTitles.has(page.title)) {
          const newTitle = `${page.title}（統合:${page.id}）`;
          await tx.companyWikiPage.update({
            where: { id: page.id },
            data: { title: newTitle },
          });
          targetTitles.add(newTitle);
        }
      }

      const targetAssocIds = (
        await tx.companyAssociation.findMany({
          where: { companyId: targetId },
          select: { associationId: true },
        })
      ).map((r) => r.associationId);

      if (targetAssocIds.length > 0) {
        await tx.companyAssociation.deleteMany({
          where: {
            companyId: sourceId,
            associationId: { in: targetAssocIds },
          },
        });
      }

      const locationSuffix = `（${source.name}）`;
      const sourceLocations = await tx.location.findMany({
        where: { companyId: sourceId },
        select: { id: true, name: true },
      });
      for (const loc of sourceLocations) {
        await tx.location.update({
          where: { id: loc.id },
          data: {
            companyId: targetId,
            name: `${loc.name}${locationSuffix}`,
          },
        });
      }
      await tx.contact.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.deal.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.activity.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.companyComment.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.companyWikiPage.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.companyAssociation.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.project.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
      await tx.projectRelatedCompany.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });

      const sourceNotes = (source.notes ?? '').trim();
      if (sourceNotes) {
        const targetNotes = (target.notes ?? '').trim();
        const mergedNotes = targetNotes ? `${targetNotes}\n\n${sourceNotes}` : sourceNotes;
        await tx.company.update({
          where: { id: targetId },
          data: { notes: mergedNotes },
        });
      }

      await tx.company.delete({ where: { id: sourceId } });

      return {
        mergedIntoId: targetId,
        message: `企業「${source.name}」を「${target.name}」に統合しました`,
      };
    });

    res.json(result);
  } catch (e) {
    console.error('POST /companies/:id/merge', e);
    res.status(500).json({ error: '企業の統合に失敗しました' });
  }
});

// Add association to company
router.post('/:companyId/associations/:associationId', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const associationId = Number(req.params.associationId);

    const companyAssociation = await prisma.companyAssociation.create({
      data: {
        companyId,
        associationId,
      },
      include: { association: true },
    });

    res.status(201).json(companyAssociation);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'この協会は既に割り当てられています' });
    }
    res.status(500).json({ error: '協会の割り当てに失敗しました' });
  }
});

// Remove association from company
router.delete('/:companyId/associations/:associationId', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const associationId = Number(req.params.associationId);

    await prisma.companyAssociation.deleteMany({
      where: {
        companyId,
        associationId,
      },
    });

    res.json({ message: '協会の割り当てを削除しました' });
  } catch (e) {
    res.status(500).json({ error: '協会の削除に失敗しました' });
  }
});
// ==========================================
// Comments
// ==========================================

function serializeCompanyComment(
  row: Record<string, unknown> & {
    activityFileFor?: { id: number; subject: string } | null;
  }
): Record<string, unknown> & { linkedActivity: { id: number; subject: string } | null } {
  const { activityFileFor, ...rest } = row;
  return {
    ...rest,
    linkedActivity: activityFileFor ? { id: activityFileFor.id, subject: activityFileFor.subject } : null,
  };
}

// Get comments for a company
router.get('/:companyId/comments', requirePermission('companies.comments', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const comments = await prisma.companyComment.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        attachments: true,
        activityFileFor: { select: { id: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments.map(serializeCompanyComment));
  } catch (e) {
    res.status(500).json({ error: 'コメントの取得に失敗しました' });
  }
});

// Add a comment to a company
router.post('/:companyId/comments', requirePermission('companies.comments', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ error: '会社IDが不正です' });
    }

    const body = (req.body || {}) as {
      content?: string;
      sourceActivityId?: number | string;
    };
    const { content, sourceActivityId: rawSourceActivityId } = body;

    const commentIncludeWithActivity = {
      user: { select: { id: true, firstName: true, lastName: true } },
      attachments: true,
      activityFileFor: { select: { id: true, subject: true } },
    } as const;

    const commentIncludeBase = {
      user: { select: { id: true, firstName: true, lastName: true } },
      attachments: true,
    } as const;

    if (rawSourceActivityId != null && rawSourceActivityId !== '') {
      const activityId = Number(rawSourceActivityId);
      if (Number.isNaN(activityId)) {
        return res.status(400).json({ error: 'sourceActivityId が不正です' });
      }
      const activity = await prisma.activity.findFirst({
        where: { id: activityId, companyId },
      });
      if (!activity) {
        return res.status(404).json({ error: '活動が見つかりません' });
      }
      if (activity.fileCommentId) {
        const existing = await prisma.companyComment.findUnique({
          where: { id: activity.fileCommentId },
          include: commentIncludeWithActivity,
        });
        if (!existing) {
          return res.status(500).json({ error: '紐づくコメントが見つかりません' });
        }
        return res.status(200).json(serializeCompanyComment(existing as Record<string, unknown> & { activityFileFor?: { id: number; subject: string } | null }));
      }
      const defaultContent =
        typeof content === 'string' && content.trim()
          ? content.trim()
          : `活動「${activity.subject}」の添付ファイル`;
      const created = await prisma.$transaction(async (tx) => {
        const c = await tx.companyComment.create({
          data: {
            companyId,
            userId: req.userId!,
            content: defaultContent,
          },
        });
        await tx.activity.update({
          where: { id: activity.id },
          data: { fileCommentId: c.id },
        });
        return tx.companyComment.findUniqueOrThrow({
          where: { id: c.id },
          include: commentIncludeBase,
        });
      });
      return res.status(201).json(
        serializeCompanyComment({
          ...(created as Record<string, unknown>),
          activityFileFor: { id: activity.id, subject: activity.subject },
        })
      );
    }

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'コメント内容が必要です' });
    }

    const comment = await prisma.companyComment.create({
      data: {
        companyId,
        userId: req.userId!,
        content: content.trim(),
      },
      include: commentIncludeBase,
    });

    res.status(201).json(
      serializeCompanyComment({
        ...(comment as Record<string, unknown>),
        activityFileFor: null,
      })
    );
  } catch (e) {
    console.error('POST /companies/:companyId/comments', e);
    res.status(500).json({
      error: companyCommentPersistenceMessage(e, 'コメントの追加に失敗しました'),
    });
  }
});

// Update a comment
router.put('/:companyId/comments/:commentId', requirePermission('companies.comments', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const { content } = req.body;

    const existing = await prisma.companyComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'コメントが見つかりません' });
    }

    if (existing.userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: '編集権限がありません' });
      }
    }

    const comment = await prisma.companyComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        attachments: true,
        activityFileFor: { select: { id: true, subject: true } },
      },
    });

    res.json(serializeCompanyComment(comment));
  } catch (e) {
    res.status(500).json({ error: 'コメントの更新に失敗しました' });
  }
});

router.delete('/:companyId/comments/:commentId', requirePermission('companies.comments', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const commentId = Number(req.params.commentId);

    const existing = await prisma.companyComment.findFirst({
      where: { id: commentId, companyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'コメントが見つかりません' });
    }

    if (existing.userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: '削除権限がありません' });
      }
    }

    await prisma.companyComment.delete({ where: { id: commentId } });
    res.json({ message: 'コメントを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'コメントの削除に失敗しました' });
  }
});

// ==========================================
// Wiki Pages
// ==========================================

// Get all wiki pages for a company
router.get('/:companyId/wiki', requirePermission('companies.wiki', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const pages = await prisma.companyWikiPage.findMany({
      where: { companyId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { position: 'asc' },
        { title: 'asc' }
      ],
    });
    res.json(pages);
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
  }
});

// Get a specific wiki page by title
router.get('/:companyId/wiki/:title', requirePermission('companies.wiki', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;

    const page = await prisma.companyWikiPage.findUnique({
      where: {
        companyId_title: {
          companyId,
          title,
        },
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!page) {
      return res.status(404).json({ error: 'Wikiページが見つかりません' });
    }

    res.json(page);
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
  }
});

// Create or update a wiki page
router.put('/:companyId/wiki/:title', requirePermission('companies.wiki', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;
    const { content, parentId } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'コンテンツが必要です' });
    }

    const page = await prisma.companyWikiPage.upsert({
      where: {
        companyId_title: {
          companyId,
          title,
        },
      },
      update: {
        content,
        authorId: req.userId!,
        parentId: parentId ? Number(parentId) : (parentId === null ? null : undefined)
      },
      create: {
        companyId,
        title,
        content,
        authorId: req.userId!,
        parentId: parentId ? Number(parentId) : null
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(page);
  } catch (e) {
    console.error('companies.saveWikiPage error:', e);
    res.status(500).json({ error: 'Wikiページの保存に失敗しました' });
  }
});

// Delete a wiki page
router.delete('/:companyId/wiki/:title', requirePermission('companies.wiki', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;

    await prisma.companyWikiPage.delete({
      where: {
        companyId_title: {
          companyId,
          title,
        },
      },
    });

    res.json({ message: 'Wikiページを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの削除に失敗しました' });
  }
});

// Move company wiki page
router.patch('/:companyId/wiki/:title/move', requirePermission('companies.wiki', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;
    const { parentId, position } = req.body;

    const page = await prisma.companyWikiPage.update({
      where: {
        companyId_title: {
          companyId,
          title
        }
      },
      data: {
        parentId: parentId === undefined ? undefined : parentId,
        position: position === undefined ? undefined : Number(position)
      }
    });
    res.json(page);
  } catch (e) {
    console.error('companies.moveWikiPage error:', e);
    res.status(500).json({ error: 'Wikiページの移動に失敗しました' });
  }
});

// ==========================================
// Locations
// ==========================================

// Get all locations for a company
router.get('/:companyId/locations', requirePermission('companies.locations', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const locations = await prisma.location.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(locations);
  } catch (e) {
    res.status(500).json({ error: '拠点の取得に失敗しました' });
  }
});

// Create a location
router.post('/:companyId/locations', requirePermission('companies.locations', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const { name, phone, fax, postalCode, prefecture, city, street, building, notes, latitude, longitude } = req.body;

    if (!name) {
      return res.status(400).json({ error: '拠点名が必要です' });
    }

    const location = await prisma.location.create({
      data: {
        companyId,
        name,
        phone,
        fax,
        postalCode,
        prefecture,
        city,
        street,
        building,
        notes,
        isProfileDisplay: req.body.isProfileDisplay || false,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      },
    });

    res.status(201).json(location);
  } catch (e) {
    res.status(500).json({ error: '拠点の作成に失敗しました' });
  }
});

// Update a location
router.put('/:companyId/locations/:locationId', requirePermission('companies.locations', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const locationId = Number(req.params.locationId);
    const { name, phone, fax, postalCode, prefecture, city, street, building, notes, latitude, longitude } = req.body;

    const location = await prisma.location.update({
      where: { id: locationId },
      data: {
        name,
        phone,
        fax,
        postalCode,
        prefecture,
        city,
        street,
        building,
        notes,
        isProfileDisplay: req.body.isProfileDisplay,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      },
    });

    res.json(location);
  } catch (e) {
    res.status(500).json({ error: '拠点の更新に失敗しました' });
  }
});

// Delete a location
router.delete('/:companyId/locations/:locationId', requirePermission('companies.locations', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const locationId = Number(req.params.locationId);

    await prisma.location.delete({
      where: { id: locationId },
    });

    res.json({ message: '拠点を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '拠点の削除に失敗しました' });
  }
});

export default router;
