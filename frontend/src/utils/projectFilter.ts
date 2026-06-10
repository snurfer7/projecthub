import { Project } from '../types';

export type ProjectFilterCriteria = {
  searchQuery: string;
  dueDateStart: string;
  dueDateEnd: string;
  companyIds: (number | string)[];
};

export function defaultProjectFilterCriteria(): ProjectFilterCriteria {
  return {
    searchQuery: '',
    dueDateStart: '',
    dueDateEnd: '',
    companyIds: [],
  };
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function projectSearchHaystack(project: Project): string {
  const parts = [
    project.name,
    project.identifier,
    project.description ?? '',
    project.company?.name ?? '',
    project.parent?.name ?? '',
    ...(project.relatedCompanies?.map((rc) => rc.company?.name ?? '') ?? []),
  ];
  return parts.join('\n').toLowerCase();
}

export function matchesProjectFilter(project: Project, criteria: ProjectFilterCriteria): boolean {
  const q = normalizeSearchQuery(criteria.searchQuery);
  if (q && !projectSearchHaystack(project).includes(q)) {
    return false;
  }

  if (criteria.companyIds.length > 0) {
    const hasMatchingCompany =
      (project.companyId != null &&
        criteria.companyIds.some((id) => String(id) === String(project.companyId))) ||
      (project.relatedCompanies?.some((rc) =>
        criteria.companyIds.some((id) => String(id) === String(rc.companyId)),
      ) ??
        false);
    if (!hasMatchingCompany) return false;
  }

  const { dueDateStart, dueDateEnd } = criteria;
  if (dueDateStart || dueDateEnd) {
    if (!project.dueDate) return false;
    const due = project.dueDate.slice(0, 10);
    if (dueDateStart && due < dueDateStart) return false;
    if (dueDateEnd && due > dueDateEnd) return false;
  }

  return true;
}

export function filterProjects(projects: Project[], criteria: ProjectFilterCriteria): Project[] {
  return projects.filter((project) => matchesProjectFilter(project, criteria));
}

export function filteredProjectIdSet(projects: Project[], criteria: ProjectFilterCriteria): Set<number> {
  return new Set(filterProjects(projects, criteria).map((p) => p.id));
}
