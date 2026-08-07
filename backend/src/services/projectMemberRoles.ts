import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Delete the given ProjectMember rows when they no longer hold any role. */
async function deleteRolelessMembers(tx: Tx, memberIds: number[]): Promise<void> {
  if (memberIds.length === 0) return;
  await tx.projectMember.deleteMany({
    where: { id: { in: memberIds }, roles: { none: {} } },
  });
}

/**
 * Drop leftover ProjectMemberRole rows sourced from the given groups (legacy),
 * then remove members left without any role.
 */
export async function removeGroupSourcedRoles(
  tx: Tx,
  filter: { groupIds: number[]; userIds?: number[]; projectId?: number }
): Promise<void> {
  if (filter.groupIds.length === 0) return;
  if (filter.userIds && filter.userIds.length === 0) return;

  const rows = await tx.projectMemberRole.findMany({
    where: {
      sourceGroupId: { in: filter.groupIds },
      member: {
        ...(filter.projectId !== undefined ? { projectId: filter.projectId } : {}),
        ...(filter.userIds ? { userId: { in: filter.userIds } } : {}),
      },
    },
    select: { id: true, projectMemberId: true },
  });
  if (rows.length === 0) return;

  await tx.projectMemberRole.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  await deleteRolelessMembers(tx, [...new Set(rows.map((r) => r.projectMemberId))]);
}

/**
 * Remove an individual project member assignment (all of their stored roles).
 * Returns true when the member row was deleted.
 */
export async function removeIndividualMember(
  tx: Tx,
  memberId: number,
  options?: { deleteWhenEmpty?: boolean }
): Promise<boolean> {
  const deleteWhenEmpty = options?.deleteWhenEmpty ?? true;
  await tx.projectMemberRole.deleteMany({ where: { projectMemberId: memberId } });
  if (!deleteWhenEmpty) return false;
  const deleted = await tx.projectMember.deleteMany({ where: { id: memberId } });
  return deleted.count > 0;
}
