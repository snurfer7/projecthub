/**
 * GET /issues・GET /gantt/* 向けの Query を組み立てる。
 * 担当者は assignedToIds と assignedToGroupIds を同時指定可（API 側で OR）。
 * includeUnassigned 時は担当者 Query を付けず、クライアントで OR 判定する。
 */
export function buildIssueListQueryParams(opts: {
  projectId?: number | string | null;
  trackerIds?: (number | string)[];
  statusIds?: (number | string)[];
  assignedToIds?: (number | string)[];
  assignedToGroupIds?: (number | string)[];
  includeUnassigned?: boolean;
}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (opts.projectId != null && String(opts.projectId).trim() !== '') {
    const pid = Number(opts.projectId);
    if (!Number.isNaN(pid)) params.projectId = pid;
  }
  if (opts.trackerIds && opts.trackerIds.length > 0) {
    params.trackerIds = opts.trackerIds.join(',');
  }
  if (opts.statusIds && opts.statusIds.length > 0) {
    params.statusIds = opts.statusIds.join(',');
  }
  if (!opts.includeUnassigned) {
    if (opts.assignedToIds && opts.assignedToIds.length > 0) {
      params.assignedToIds = opts.assignedToIds.join(',');
    }
    if (opts.assignedToGroupIds && opts.assignedToGroupIds.length > 0) {
      params.assignedToGroupIds = opts.assignedToGroupIds.join(',');
    }
  }
  return params;
}
