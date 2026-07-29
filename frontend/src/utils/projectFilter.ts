import { Project } from '../types';
import {
  effectiveDateRange,
  type DateRangeRelativePreset,
  type DateRangeSpecifyMode,
} from './dateRangeSpecify';

/**
 * 企業フィルタで「自社」（企業が未設定のプロジェクト）を表す特別な選択肢の値。
 */
export const SELF_COMPANY_FILTER_VALUE = '__self__';

export type ProjectFilterCriteria = {
  searchQuery: string;
  dueDateStart: string;
  dueDateEnd: string;
  dueDateMode: DateRangeSpecifyMode;
  dueDateRelative: DateRangeRelativePreset | '';
  companyIds: (number | string)[];
  statuses: string[];
};

export function defaultProjectFilterCriteria(): ProjectFilterCriteria {
  return {
    searchQuery: '',
    dueDateStart: '',
    dueDateEnd: '',
    dueDateMode: 'direct',
    dueDateRelative: '',
    companyIds: [],
    statuses: [],
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
    const includesSelf = criteria.companyIds.some(
      (id) => String(id) === SELF_COMPANY_FILTER_VALUE,
    );
    const companyIds = criteria.companyIds.filter(
      (id) => String(id) !== SELF_COMPANY_FILTER_VALUE,
    );

    // 「自社」= 企業が未設定のプロジェクト
    const matchesSelf = includesSelf && project.companyId == null;
    const matchesSelectedCompany =
      companyIds.length > 0 &&
      ((project.companyId != null &&
        companyIds.some((id) => String(id) === String(project.companyId))) ||
        (project.relatedCompanies?.some((rc) =>
          companyIds.some((id) => String(id) === String(rc.companyId)),
        ) ??
          false));

    if (!matchesSelf && !matchesSelectedCompany) return false;
  }

  if (criteria.statuses.length > 0 && !criteria.statuses.includes(project.status)) {
    return false;
  }

  const { dueDateStart, dueDateEnd, dueDateMode, dueDateRelative } = criteria;
  const dueRange = effectiveDateRange(dueDateMode, dueDateRelative, dueDateStart, dueDateEnd);
  if (dueRange.start || dueRange.end) {
    if (!project.dueDate) return false;
    const due = project.dueDate.slice(0, 10);
    if (dueRange.start && due < dueRange.start) return false;
    if (dueRange.end && due > dueRange.end) return false;
  }

  return true;
}

export function filterProjects(projects: Project[], criteria: ProjectFilterCriteria): Project[] {
  return projects.filter((project) => matchesProjectFilter(project, criteria));
}

export function filteredProjectIdSet(projects: Project[], criteria: ProjectFilterCriteria): Set<number> {
  return new Set(filterProjects(projects, criteria).map((p) => p.id));
}
