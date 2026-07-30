import { PrismaClient } from '@prisma/client';

export const assigneeUserSelect = { id: true, firstName: true, lastName: true } as const;

export const issueAssigneesInclude = {
  assignees: {
    include: { user: { select: assigneeUserSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type AssigneeLink = {
  user: { id: number; firstName: string; lastName: string };
};

/** Prisma の assignees リレーションを API 応答形に展開し、旧 assignedTo / assignedToId を先頭から導出する */
export function shapeIssueAssignees<T extends { assignees?: AssigneeLink[] }>(
  issue: T,
): Omit<T, 'assignees'> & {
  assignees: { id: number; firstName: string; lastName: string }[];
  assignedTo: { id: number; firstName: string; lastName: string } | null;
  assignedToId: number | null;
} {
  const { assignees: links, ...rest } = issue;
  const assignees = (links ?? []).map((l) => l.user);
  return {
    ...rest,
    assignees,
    assignedTo: assignees[0] ?? null,
    assignedToId: assignees[0]?.id ?? null,
  };
}

/** Body の assignedToIds / 旧 assignedToId から正規化した userId 配列を得る。未指定時は null */
export function parseAssignedToIdsFromBody(body: Record<string, unknown>): number[] | null {
  if (Array.isArray(body.assignedToIds)) {
    return [
      ...new Set(
        body.assignedToIds
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ];
  }
  if ('assignedToId' in body && body.assignedToId !== undefined) {
    if (body.assignedToId == null || body.assignedToId === '') return [];
    const n = Number(body.assignedToId);
    return Number.isInteger(n) && n > 0 ? [n] : [];
  }
  return null;
}

export async function validateAssignableUserIds(
  prisma: PrismaClient,
  userIds: number[],
): Promise<string | null> {
  if (userIds.length === 0) return null;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, status: true },
  });
  if (users.length !== userIds.length) {
    return '指定された担当者が見つかりません';
  }
  if (users.some((u) => u.status === 'pending' || u.status === 'inactive')) {
    return '選択されたユーザー（仮登録または無効）は担当者に指定できません';
  }
  return null;
}

export async function syncIssueAssignees(
  prisma: PrismaClient,
  issueId: number,
  userIds: number[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.issueAssignee.deleteMany({
      where: {
        issueId,
        ...(userIds.length > 0 ? { userId: { notIn: userIds } } : {}),
      },
    });
    for (const userId of userIds) {
      await tx.issueAssignee.upsert({
        where: { issueId_userId: { issueId, userId } },
        create: { issueId, userId },
        update: {},
      });
    }
  });
}

export function assigneeIdsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}
