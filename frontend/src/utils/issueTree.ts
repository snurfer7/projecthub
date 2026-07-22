import { Issue } from '../types';

/** 子を持たない末端チケットか（API の _count.children を優先） */
export function isLeafIssue(issue: Issue, allIssues?: Issue[]): boolean {
  if (issue._count?.children != null) {
    return issue._count.children === 0;
  }
  if (!allIssues) return true;
  return !allIssues.some((i) => i.parentId === issue.id);
}

/** 一番上の親から直前の親までの祖先チェーン（ルートが先頭。自身は含まない） */
export function getAncestorChain(
  issue: Issue,
  byId: Map<number, Pick<Issue, 'id' | 'subject' | 'parentId'>>
): { id: number; subject: string }[] {
  const chain: { id: number; subject: string }[] = [];
  const seen = new Set<number>();
  let parentId = issue.parentId ?? null;

  while (parentId != null) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) {
      if (chain.length === 0 && issue.parent && issue.parent.id === parentId) {
        chain.unshift({ id: issue.parent.id, subject: issue.parent.subject });
      }
      break;
    }
    chain.unshift({ id: parent.id, subject: parent.subject });
    parentId = parent.parentId ?? null;
  }

  return chain;
}

export function buildIssueByIdMap(issues: Issue[]): Map<number, Issue> {
  return new Map(issues.map((i) => [i.id, i]));
}
