import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultProjectFilterCriteria,
  type ProjectFilterCriteria,
} from '../utils/projectFilter';
import { defaultIssueFilterCriteria, type IssueFilterCriteria } from '../utils/issueFilter';
import {
  PROJECT_LIST_RESET_EVENT,
  PROJECT_LIST_STORAGE_KEY,
  defaultPersistedProjectList,
  readPersistedProjectList,
  type PersistedProjectList,
  type ProjectListViewMode,
} from '../utils/projectListStorage';

export function useProjectListFilters(initialViewMode?: ProjectListViewMode) {
  const persisted = useMemo(() => readPersistedProjectList(), []);
  const defaults = defaultPersistedProjectList();

  const [viewMode, setViewMode] = useState<ProjectListViewMode>(
    () => initialViewMode ?? persisted?.viewMode ?? defaults.viewMode,
  );
  const [projectFilter, setProjectFilter] = useState<ProjectFilterCriteria>(
    () => persisted?.projectFilter ?? defaults.projectFilter,
  );
  const [issueFilter, setIssueFilter] = useState<IssueFilterCriteria>(
    () => persisted?.issueFilter ?? defaults.issueFilter,
  );
  const [ganttZoom, setGanttZoom] = useState<'day' | 'month' | 'year'>(
    () => persisted?.ganttZoom ?? defaults.ganttZoom,
  );
  const [showEmptyProjects, setShowEmptyProjects] = useState(
    () => persisted?.showEmptyProjects ?? defaults.showEmptyProjects,
  );

  useEffect(() => {
    try {
      const payload: PersistedProjectList = {
        v: 1,
        viewMode,
        projectFilter,
        issueFilter,
        ganttZoom,
        showEmptyProjects,
      };
      sessionStorage.setItem(PROJECT_LIST_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / private mode
    }
  }, [viewMode, projectFilter, issueFilter, ganttZoom, showEmptyProjects]);

  useEffect(() => {
    const onReset = () => {
      const d = defaultPersistedProjectList();
      setViewMode(d.viewMode);
      setProjectFilter(d.projectFilter);
      setIssueFilter(d.issueFilter);
      setGanttZoom(d.ganttZoom);
      setShowEmptyProjects(d.showEmptyProjects);
    };
    window.addEventListener(PROJECT_LIST_RESET_EVENT, onReset);
    return () => window.removeEventListener(PROJECT_LIST_RESET_EVENT, onReset);
  }, []);

  const resetProjectFilter = useCallback(() => {
    setProjectFilter(defaultProjectFilterCriteria());
  }, []);

  const resetIssueFilter = useCallback(() => {
    setIssueFilter(defaultIssueFilterCriteria());
  }, []);

  const updateProjectFilter = useCallback((patch: Partial<ProjectFilterCriteria>) => {
    setProjectFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateIssueFilter = useCallback((patch: Partial<IssueFilterCriteria>) => {
    setIssueFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    viewMode,
    setViewMode,
    projectFilter,
    setProjectFilter,
    updateProjectFilter,
    resetProjectFilter,
    issueFilter,
    setIssueFilter,
    updateIssueFilter,
    resetIssueFilter,
    ganttZoom,
    setGanttZoom,
    showEmptyProjects,
    setShowEmptyProjects,
  };
}
