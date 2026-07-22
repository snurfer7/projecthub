import { Project } from '../types';

export type ProjectTreeDisplayRow = {
  project: Project;
  depth: number;
  hasChildren: boolean;
};

/** フィルタ済みプロジェクトを親子階層の表示行に並べる（折りたたみ対応） */
export function buildProjectTreeDisplayRows(
  projects: Project[],
  collapsedIds: Set<number>,
): ProjectTreeDisplayRow[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const childrenMap = new Map<number, Project[]>();
  for (const project of projects) {
    if (project.parentId != null && byId.has(project.parentId)) {
      const list = childrenMap.get(project.parentId) ?? [];
      list.push(project);
      childrenMap.set(project.parentId, list);
    }
  }
  for (const [, list] of childrenMap) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  const roots = projects
    .filter((p) => p.parentId == null || !byId.has(p.parentId))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const result: ProjectTreeDisplayRow[] = [];
  const visited = new Set<number>();

  const markDescendantsVisited = (id: number) => {
    for (const child of childrenMap.get(id) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      markDescendantsVisited(child.id);
    }
  };

  const visit = (project: Project, depth: number) => {
    if (visited.has(project.id)) return;
    visited.add(project.id);
    const children = childrenMap.get(project.id) ?? [];
    result.push({
      project,
      depth,
      hasChildren: children.length > 0,
    });
    if (collapsedIds.has(project.id)) {
      // 折りたたみ中の子孫を orphan フォールバックで再表示しない
      markDescendantsVisited(project.id);
      return;
    }
    children.forEach((child) => visit(child, depth + 1));
  };

  roots.forEach((root) => visit(root, 0));
  projects.forEach((p) => {
    if (!visited.has(p.id)) visit(p, 0);
  });
  return result;
}
