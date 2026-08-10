import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { List, BarChart2, Kanban, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import api from '../api/client';
import {
  Project,
  Company,
  Issue,
  IssueStatus,
  TimeEntry,
  SavedSearch,
  PermissionMap,
  IssueMetaWorkflow,
} from '../types';
import Modal from '../components/Modal';
import GanttChart from '../components/GanttChart';
import ProjectListFilterPanel from '../components/ProjectListFilterPanel';
import ProjectListSortModal from '../components/ProjectListSortModal';
import IssueListSortModal from '../components/IssueListSortModal';
import KanbanBoard from '../components/KanbanBoard';
import IssueDetail from '../components/IssueDetail';
import { IssueFormModal } from '../components/IssueForm';
import TimeRecordTree from '../components/TimeRecordTree';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useProjectListFilters } from '../hooks/useProjectListFilters';
import { filterProjects, filteredProjectIdSet } from '../utils/projectFilter';
import { filterIssues, filterIssuesByProjectIds } from '../utils/issueFilter';
import { buildIssueListQueryParams } from '../utils/issueListQueryParams';
import { isLeafIssue } from '../utils/issueTree';
import {
  buildProjectTreeDisplayRows,
  filterProjectsKeepingAncestorsOfTicketed,
  PROJECT_LIST_SORT_OPTIONS,
  createSortEntry,
  isOptionalSortKey,
  type ProjectListEmptyPlacement,
  type ProjectListSort,
  type ProjectListSortDirection,
  type ProjectListSortKey,
} from '../utils/projectTree';
import {
  ISSUE_LIST_SORT_OPTIONS,
  createIssueSortEntry,
  isOptionalIssueSortKey,
  type IssueListEmptyPlacement,
  type IssueListSort,
  type IssueListSortDirection,
  type IssueListSortKey,
} from '../utils/issueSort';
import type { ProjectListViewMode } from '../utils/projectListStorage';
import ProjectCreateForm, {
  emptyProjectCreateFormValues,
  projectCreatePayload,
  type ProjectCreateFormValues,
} from '../components/ProjectCreateForm';
import {
  effectiveDateRange,
  isDateRangeRelativePreset,
  resolveRelativeDateRange,
  type DateRangeRelativePreset,
  type DateRangeSpecifyMode,
} from '../utils/dateRangeSpecify';
import type { DateRangeSpecifyValue } from '../components/DateRangeSpecify';
import { splitTimeRecordFilterSelection } from '../utils/timeRecordFilter';

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialViewMode = searchParams.get('view') === 'gantt' ? 'gantt' : undefined;
  const {
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
    listSort,
    setListSort,
    issueSort,
    setIssueSort,
  } = useProjectListFilters(initialViewMode);

  useEffect(() => {
    if (searchParams.get('view') !== 'gantt') return;
    setViewMode('gantt');
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setViewMode]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [ganttIssues, setGanttIssues] = useState<Issue[]>([]);
  const [ganttProjects, setGanttProjects] = useState<Project[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [ganttStartValue, setGanttStartValue] = useState('');
  const [ganttEndValue, setGanttEndValue] = useState('');
  const [ganttCollapsedProjects, setGanttCollapsedProjects] = useState<Set<number>>(new Set());
  const [listCollapsedIds, setListCollapsedIds] = useState<Set<number>>(() => new Set());
  const [showSortModal, setShowSortModal] = useState(false);
  const [showIssueSortModal, setShowIssueSortModal] = useState(false);

  const [kanbanIssues, setKanbanIssues] = useState<Issue[]>([]);
  const [kanbanStatuses, setKanbanStatuses] = useState<IssueStatus[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { user } = useAuth();
  const { canUse } = usePermissions(user?.permissions);

  // 保存済み検索（ページで一度だけ取得し、デフォルト適用とドロップダウン表示で共有する）
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<number | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const [timeIssues, setTimeIssues] = useState<Issue[]>([]);
  const [timeStatuses, setTimeStatuses] = useState<IssueStatus[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timePermByProject, setTimePermByProject] = useState<Record<number, PermissionMap>>({});
  const [timeWorkflowByProject, setTimeWorkflowByProject] = useState<
    Record<number, IssueMetaWorkflow | null>
  >({});
  const [timeRecordDate, setTimeRecordDate] = useState<DateRangeSpecifyValue>({
    mode: 'direct',
    relative: '',
    start: '',
    end: '',
  });
  const [timeRecordFilterUserIds, setTimeRecordFilterUserIds] = useState<(number | string)[]>([]);
  const prevViewModeRef = useRef<ProjectListViewMode | null>(null);
  const timeDefaultsUserIdRef = useRef<number | null>(null);
  const timeIssueFilterKeyRef = useRef('');
  const timeEntryFilterKeyRef = useRef('');

  const applyTimeViewDefaults = useCallback(() => {
    if (!user) return;
    updateIssueFilter({
      assignedToIds: [],
      assignedToGroupIds: [],
      assignedToGroupMemberIds: [],
      includeUnassigned: false,
      dueDateStart: '',
      dueDateEnd: '',
      dueDateMode: 'direct',
      dueDateRelative: '',
      scheduleDateStart: '',
      scheduleDateEnd: '',
      scheduleDateMode: 'direct',
      scheduleDateRelative: '',
      includeUnscheduled: false,
    });
    setTimeRecordDate({ mode: 'direct', relative: '', start: '', end: '' });
    setTimeRecordFilterUserIds([]);
    timeDefaultsUserIdRef.current = user.id;
  }, [user, updateIssueFilter]);

  /** 保存済み検索条件を画面状態に反映する（相対指定の日付は再計算。時間タブでは期限を使わず開始・終了期間を使う） */
  const applyFilter = useCallback(
    (search: SavedSearch) => {
      const f = search.filter;
      if (f.projectFilter) {
        const savedProject = f.projectFilter;
        setProjectFilter((prev) => {
          const next = { ...prev, ...savedProject };
          next.memberIds = savedProject.memberIds ?? [];
          next.memberGroupIds = savedProject.memberGroupIds ?? [];
          next.memberGroupMemberIds = savedProject.memberGroupMemberIds ?? [];
          if (next.dueDateMode === 'relative' && isDateRangeRelativePreset(next.dueDateRelative)) {
            const range = resolveRelativeDateRange(next.dueDateRelative);
            next.dueDateStart = range.start;
            next.dueDateEnd = range.end;
          } else if (savedProject.dueDateMode === 'direct' || savedProject.dueDateStart !== undefined) {
            next.dueDateMode = 'direct';
            next.dueDateRelative = '';
            next.dueDateStart = savedProject.dueDateStart ?? '';
            next.dueDateEnd = savedProject.dueDateEnd ?? '';
          }
          return next;
        });
      }
      if (f.issueFilter) {
        const savedIssue = f.issueFilter;
        setIssueFilter((prev) => {
          const next = { ...prev, ...savedIssue };
          next.assignedToGroupMemberIds = [];
          next.includeUnassigned = savedIssue.includeUnassigned === true;
          next.includeUnscheduled = savedIssue.includeUnscheduled === true;
          if (viewMode === 'time') {
            next.dueDateStart = '';
            next.dueDateEnd = '';
            next.dueDateMode = 'direct';
            next.dueDateRelative = '';
          }
          if (viewMode === 'gantt' || viewMode === 'kanban') {
            if (next.dueDateMode === 'relative' && isDateRangeRelativePreset(next.dueDateRelative)) {
              const range = resolveRelativeDateRange(next.dueDateRelative);
              next.dueDateStart = range.start;
              next.dueDateEnd = range.end;
            } else if (savedIssue.dueDateMode === 'direct' || savedIssue.dueDateStart !== undefined) {
              next.dueDateMode = 'direct';
              next.dueDateRelative = '';
              next.dueDateStart = savedIssue.dueDateStart ?? '';
              next.dueDateEnd = savedIssue.dueDateEnd ?? '';
            }
          }
          if (viewMode === 'gantt' || viewMode === 'kanban' || viewMode === 'time') {
            if (next.scheduleDateMode === 'relative' && isDateRangeRelativePreset(next.scheduleDateRelative)) {
              const range = resolveRelativeDateRange(next.scheduleDateRelative);
              next.scheduleDateStart = range.start;
              next.scheduleDateEnd = range.end;
            } else if (
              savedIssue.scheduleDateMode === 'direct' ||
              savedIssue.scheduleDateStart !== undefined
            ) {
              next.scheduleDateMode = 'direct';
              next.scheduleDateRelative = '';
              next.scheduleDateStart = savedIssue.scheduleDateStart ?? '';
              next.scheduleDateEnd = savedIssue.scheduleDateEnd ?? '';
            }
          } else {
            next.scheduleDateStart = '';
            next.scheduleDateEnd = '';
            next.scheduleDateMode = 'direct';
            next.scheduleDateRelative = '';
            next.includeUnscheduled = false;
          }
          return next;
        });
      }
      if (f.ganttZoom) setGanttZoom(f.ganttZoom);
      if (f.showEmptyProjects !== undefined) setShowEmptyProjects(f.showEmptyProjects);
      if (f.timeRecordFilterUserIds !== undefined) setTimeRecordFilterUserIds(f.timeRecordFilterUserIds);
      if (
        f.timeRecordStartDate !== undefined ||
        f.timeRecordEndDate !== undefined ||
        f.timeRecordDateMode !== undefined ||
        f.timeRecordDateRelative !== undefined
      ) {
        setTimeRecordDate((prev) => {
          const mode: DateRangeSpecifyMode =
            f.timeRecordDateMode === 'relative' || f.timeRecordDateMode === 'direct'
              ? f.timeRecordDateMode
              : prev.mode;
          const relative: DateRangeRelativePreset | '' = isDateRangeRelativePreset(
            f.timeRecordDateRelative,
          )
            ? f.timeRecordDateRelative
            : f.timeRecordDateRelative === ''
              ? ''
              : prev.relative;
          if (mode === 'relative' && isDateRangeRelativePreset(relative)) {
            const range = resolveRelativeDateRange(relative);
            return { mode, relative, start: range.start, end: range.end };
          }
          return {
            mode: 'direct',
            relative: '',
            start: f.timeRecordStartDate ?? '',
            end: f.timeRecordEndDate ?? '',
          };
        });
      }
      if (Array.isArray(f.listSort)) {
        const validKeys = new Set(PROJECT_LIST_SORT_OPTIONS.map((o) => o.key));
        const parsed: ProjectListSort[] = [];
        const seen = new Set<ProjectListSortKey>();
        for (const item of f.listSort) {
          if (!item || typeof item !== 'object') continue;
          const key = item.key as ProjectListSortKey;
          const direction = item.direction as ProjectListSortDirection;
          if (!validKeys.has(key) || (direction !== 'asc' && direction !== 'desc')) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          const entry = createSortEntry(key, direction);
          if (
            isOptionalSortKey(key) &&
            (item.emptyPlacement === 'first' || item.emptyPlacement === 'last')
          ) {
            entry.emptyPlacement = item.emptyPlacement as ProjectListEmptyPlacement;
          }
          parsed.push(entry);
        }
        if (parsed.length > 0) setListSort(parsed);
      }
      if (Array.isArray(f.issueSort)) {
        const validKeys = new Set(ISSUE_LIST_SORT_OPTIONS.map((o) => o.key));
        const parsed: IssueListSort[] = [];
        const seen = new Set<IssueListSortKey>();
        for (const item of f.issueSort) {
          if (!item || typeof item !== 'object') continue;
          const key = item.key as IssueListSortKey;
          const direction = item.direction as IssueListSortDirection;
          if (!validKeys.has(key) || (direction !== 'asc' && direction !== 'desc')) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          const entry = createIssueSortEntry(key, direction);
          if (
            isOptionalIssueSortKey(key) &&
            (item.emptyPlacement === 'first' || item.emptyPlacement === 'last')
          ) {
            entry.emptyPlacement = item.emptyPlacement as IssueListEmptyPlacement;
          }
          parsed.push(entry);
        }
        if (parsed.length > 0) setIssueSort(parsed);
      }
      setActiveSavedSearchId(search.id);
    },
    [setProjectFilter, setIssueFilter, setGanttZoom, setShowEmptyProjects, setListSort, setIssueSort, viewMode],
  );

  /** 保存済み検索のデフォルトを自動適用（表示モード切替時）。古い応答は破棄する */
  const savedSearchRequestGenRef = useRef(0);
  /** ビュー切替時のリセット〜デフォルト適用が終わるまでチケット取得を抑止する */
  const [filterBootstrapReady, setFilterBootstrapReady] = useState(false);
  const filterBootstrapGenRef = useRef(0);
  /** ガント／カンバン／時間の取得応答の世代（古い応答を破棄） */
  const ganttLoadGenRef = useRef(0);
  const kanbanLoadGenRef = useRef(0);
  const timeLoadGenRef = useRef(0);

  const applyDefaultSavedSearch = useCallback(
    async (mode: ProjectListViewMode) => {
      if (!canUse('projects.saved-searches')) {
        setSavedSearches([]);
        return;
      }
      const gen = ++savedSearchRequestGenRef.current;
      try {
        const res = await api.get('/saved-searches', { params: { viewMode: mode } });
        if (gen !== savedSearchRequestGenRef.current) return;
        const list: SavedSearch[] = res.data;
        setSavedSearches(list);
        const def = list.find((s) => s.isDefault);
        if (def) applyFilter(def);
      } catch {
        // 接続エラーは無視
      }
    },
    [applyFilter, canUse],
  );

  // 保存済み検索の再取得（保存／削除／デフォルト変更などの後に呼ぶ）。
  // デフォルトの自動適用は行わず、一覧のみ更新する。
  const reloadSavedSearches = useCallback(async () => {
    if (!canUse('projects.saved-searches')) {
      setSavedSearches([]);
      return;
    }
    const gen = ++savedSearchRequestGenRef.current;
    try {
      const res = await api.get('/saved-searches', { params: { viewMode } });
      if (gen !== savedSearchRequestGenRef.current) return;
      setSavedSearches(res.data);
    } catch {
      // 接続エラーは無視
    }
  }, [canUse, viewMode]);

  // ビュー切替時: 条件リセット → デフォルト保存済み検索を適用 → その後にデータ取得を許可
  // ※ 時間タブ初期値エフェクトより先に定義することで、React のエフェクト実行順（定義順）に従い
  //   このリセットが先に走り、その後に時間タブ初期値が上書きされる形になる
  // ※ 時間タブの担当者初期値がガント等に残らないよう、切替時は必ず issueFilter をリセットする
  // ※ デフォルト適用前に空条件で API を叩くと、終了チケット等が一瞬／残留表示されるため
  //   filterBootstrapReady が true になるまでガント／カンバン／時間の取得を行わない
  const prevViewModeForSavedRef = useRef<ProjectListViewMode | null>(null);
  useEffect(() => {
    if (prevViewModeForSavedRef.current === viewMode) return;
    prevViewModeForSavedRef.current = viewMode;
    const bootstrapGen = ++filterBootstrapGenRef.current;
    setFilterBootstrapReady(false);
    // 切替中に飛んでいた取得の応答を破棄し、直前ビューのチケット表示を残さない
    ganttLoadGenRef.current += 1;
    kanbanLoadGenRef.current += 1;
    timeLoadGenRef.current += 1;
    setGanttIssues([]);
    setGanttProjects([]);
    setKanbanIssues([]);
    setTimeIssues([]);
    setTimeEntries([]);
    savedSearchRequestGenRef.current += 1;
    resetProjectFilter();
    resetIssueFilter();
    setActiveSavedSearchId(null);
    void (async () => {
      await applyDefaultSavedSearch(viewMode);
      if (bootstrapGen !== filterBootstrapGenRef.current) return;
      setFilterBootstrapReady(true);
    })();
  }, [viewMode, resetProjectFilter, resetIssueFilter, applyDefaultSavedSearch]);

  // 時間タブの初期値を適用（保存済みデフォルト検索がない場合のみ）
  useEffect(() => {
    if (viewMode !== 'time' || !user) {
      if (viewMode !== 'time') {
        prevViewModeRef.current = viewMode;
        timeDefaultsUserIdRef.current = null;
      }
      return;
    }
    const enteredTime = prevViewModeRef.current !== 'time';
    const userBecameAvailable = timeDefaultsUserIdRef.current !== user.id;
    if ((enteredTime || userBecameAvailable) && activeSavedSearchId == null) {
      applyTimeViewDefaults();
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, user, applyTimeViewDefaults, activeSavedSearchId]);

  const resetAllFilters = useCallback(() => {
    resetProjectFilter();
    resetIssueFilter();
    setGanttStartValue('');
    setGanttEndValue('');
    setActiveSavedSearchId(null);
    if (viewMode === 'time' && user) {
      updateIssueFilter({
        assignedToIds: [],
        assignedToGroupIds: [],
        assignedToGroupMemberIds: [],
        includeUnassigned: false,
        dueDateStart: '',
        dueDateEnd: '',
        dueDateMode: 'direct',
        dueDateRelative: '',
        scheduleDateStart: '',
        scheduleDateEnd: '',
        scheduleDateMode: 'direct',
        scheduleDateRelative: '',
        includeUnscheduled: false,
      });
      setTimeRecordDate({ mode: 'direct', relative: '', start: '', end: '' });
      setTimeRecordFilterUserIds([]);
    } else {
      setTimeRecordDate({ mode: 'direct', relative: '', start: '', end: '' });
      setTimeRecordFilterUserIds([]);
    }
  }, [resetProjectFilter, resetIssueFilter, viewMode, user, updateIssueFilter]);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectCreateFormValues>(emptyProjectCreateFormValues);
  const [projectError, setProjectError] = useState('');

  const patchProjectForm = (patch: Partial<ProjectCreateFormValues>) => {
    setProjectForm((prev) => ({ ...prev, ...patch }));
  };

  const loadProjects = () => {
    api.get('/projects').then((res) => setProjects(res.data));
  };

  const loadCompanies = () => {
    api.get('/companies').then((res) => setCompanies(res.data));
  };

  const loadGanttData = useCallback(() => {
    const gen = ++ganttLoadGenRef.current;
    const params = buildIssueListQueryParams({
      trackerIds: issueFilter.trackerIds,
      statusIds: issueFilter.statusIds,
      assignedToIds: issueFilter.assignedToIds,
      assignedToGroupIds: issueFilter.assignedToGroupIds,
      includeUnassigned: issueFilter.includeUnassigned,
    });
    api.get('/gantt/all', { params }).then((res) => {
      if (gen !== ganttLoadGenRef.current) return;
      setGanttProjects(res.data.projects);
      setGanttIssues(res.data.issues);
    });
    api.get('/settings/calendar').then((res) => {
      if (gen !== ganttLoadGenRef.current) return;
      setSystemSettings(res.data);
    }).catch(() => {});
  }, [
    issueFilter.trackerIds,
    issueFilter.statusIds,
    issueFilter.assignedToIds,
    issueFilter.assignedToGroupIds,
    issueFilter.includeUnassigned,
  ]);

  const loadKanbanData = useCallback(() => {
    const gen = ++kanbanLoadGenRef.current;
    const params = buildIssueListQueryParams({
      trackerIds: issueFilter.trackerIds,
      statusIds: issueFilter.statusIds,
      assignedToIds: issueFilter.assignedToIds,
      assignedToGroupIds: issueFilter.assignedToGroupIds,
      includeUnassigned: issueFilter.includeUnassigned,
    });
    Promise.all([
      api.get('/issues', { params }),
      api.get('/issues/meta/options'),
    ]).then(([issuesRes, metaRes]) => {
      if (gen !== kanbanLoadGenRef.current) return;
      setKanbanIssues(issuesRes.data);
      setKanbanStatuses(metaRes.data.statuses);
    });
  }, [
    issueFilter.trackerIds,
    issueFilter.statusIds,
    issueFilter.assignedToIds,
    issueFilter.assignedToGroupIds,
    issueFilter.includeUnassigned,
  ]);

  const buildTimeTreeEntryParams = useCallback(() => {
    const recordRange = effectiveDateRange(
      timeRecordDate.mode,
      timeRecordDate.relative,
      timeRecordDate.start,
      timeRecordDate.end,
    );
    const { userIds, userGroupIds } = splitTimeRecordFilterSelection(timeRecordFilterUserIds);
    const entryParams: Record<string, string | number> = {};
    if (recordRange.start) entryParams.startDate = recordRange.start;
    if (recordRange.end) entryParams.endDate = recordRange.end;
    if (userIds.length > 0) entryParams.userIds = userIds.join(',');
    if (userGroupIds.length > 0) entryParams.userGroupIds = userGroupIds.join(',');
    return entryParams;
  }, [timeRecordDate, timeRecordFilterUserIds]);

  const loadTimeData = useCallback(
    (opts?: { entriesOnly?: boolean }) => {
      const gen = ++timeLoadGenRef.current;
      const entryParams = buildTimeTreeEntryParams();

      if (opts?.entriesOnly) {
        return api
          .get('/time-tree', { params: { ...entryParams, include: 'entries' } })
          .then((res) => {
            if (gen !== timeLoadGenRef.current) return;
            setTimeEntries(res.data.timeEntries ?? []);
          });
      }

      const issueParams = buildIssueListQueryParams({
        trackerIds: issueFilter.trackerIds,
        statusIds: issueFilter.statusIds,
        assignedToIds: issueFilter.assignedToIds,
        assignedToGroupIds: issueFilter.assignedToGroupIds,
        includeUnassigned: issueFilter.includeUnassigned,
      });

      return api.get('/time-tree', { params: { ...issueParams, ...entryParams } }).then((res) => {
        if (gen !== timeLoadGenRef.current) return;
        setTimeIssues(res.data.issues ?? []);
        setTimeEntries(res.data.timeEntries ?? []);
        setTimeStatuses(res.data.statuses ?? []);
        setTimePermByProject(res.data.permissionsByProjectId ?? {});
        setTimeWorkflowByProject(res.data.workflowByProjectId ?? {});
      });
    },
    [
      buildTimeTreeEntryParams,
      issueFilter.trackerIds,
      issueFilter.statusIds,
      issueFilter.assignedToIds,
      issueFilter.assignedToGroupIds,
      issueFilter.includeUnassigned,
    ],
  );

  useEffect(() => {
    loadProjects();
    loadCompanies();
  }, []);

  useEffect(() => {
    if (!filterBootstrapReady) return;
    if (viewMode === 'gantt') loadGanttData();
    if (viewMode === 'kanban') loadKanbanData();
    if (viewMode !== 'time') {
      timeIssueFilterKeyRef.current = '';
      timeEntryFilterKeyRef.current = '';
      return;
    }

    const issueKey = JSON.stringify({
      trackerIds: issueFilter.trackerIds,
      statusIds: issueFilter.statusIds,
      assignedToIds: issueFilter.assignedToIds,
      assignedToGroupIds: issueFilter.assignedToGroupIds,
      includeUnassigned: issueFilter.includeUnassigned,
    });
    const entryKey = JSON.stringify({
      timeRecordDate,
      timeRecordFilterUserIds,
    });

    const issueChanged = issueKey !== timeIssueFilterKeyRef.current;
    const entryChanged = entryKey !== timeEntryFilterKeyRef.current;
    const firstLoad = timeIssueFilterKeyRef.current === '';

    timeIssueFilterKeyRef.current = issueKey;
    timeEntryFilterKeyRef.current = entryKey;

    if (firstLoad || issueChanged) {
      loadTimeData();
    } else if (entryChanged) {
      loadTimeData({ entriesOnly: true });
    }
  }, [
    viewMode,
    filterBootstrapReady,
    loadGanttData,
    loadKanbanData,
    loadTimeData,
    issueFilter.trackerIds,
    issueFilter.statusIds,
    issueFilter.assignedToIds,
    issueFilter.assignedToGroupIds,
    issueFilter.includeUnassigned,
    timeRecordDate,
    timeRecordFilterUserIds,
  ]);

  const openCreateProjectModal = () => {
    setEditingProjectId(null);
    setProjectForm(emptyProjectCreateFormValues());
    setProjectError('');
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setEditingProjectId(null);
    setProjectError('');
  };

  const handleSubmitProject = async (e: FormEvent) => {
    e.preventDefault();
    setProjectError('');
    try {
      const data = projectCreatePayload(projectForm);
      if (editingProjectId) {
        await api.put(`/projects/${editingProjectId}`, data);
      } else {
        await api.post('/projects', data);
      }
      closeProjectModal();
      loadProjects();
      if (viewMode === 'gantt') loadGanttData();
      if (viewMode === 'kanban') loadKanbanData();
      if (viewMode === 'time') loadTimeData();
    } catch (err: any) {
      setProjectError(err.response?.data?.error || (editingProjectId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const handleUpdateIssue = useCallback(async (id: number, data: { startDate?: string; endDate?: string; dueDate?: string }) => {
    await api.put(`/issues/${id}`, data);
    loadGanttData();
  }, [loadGanttData]);

  const handleCreateRelation = useCallback(async (fromId: number, toId: number) => {
    try {
      await api.post(`/issues/${fromId}/relations`, { issueToId: toId, relationType: 'precedes' });
      loadGanttData();
    } catch (e) {
      console.error('Failed to create relation:', e);
      alert('関連の作成に失敗しました');
    }
  }, [loadGanttData]);

  const handleKanbanDrop = async (droppedIssueId: number, targetStatusId: number) => {
    const issueToDrop = kanbanIssues.find((i) => i.id === droppedIssueId);
    if (!issueToDrop || issueToDrop.statusId === targetStatusId) return;

    setKanbanIssues((prev) =>
      prev.map((issue) =>
        issue.id === issueToDrop.id
          ? { ...issue, statusId: targetStatusId, status: kanbanStatuses.find((s) => s.id === targetStatusId) }
          : issue,
      ),
    );
    try {
      await api.put(`/issues/${issueToDrop.id}`, { statusId: targetStatusId });
    } catch (err: any) {
      alert(err.response?.data?.error || 'ステータスの更新に失敗しました');
      loadKanbanData();
    }
  };

  const handleIssueClick = (issueId: number) => {
    setSelectedIssueId(issueId);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  const closeIssueModal = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedIssueId(null);
  };

  const filteredProjects = useMemo(
    () => filterProjects(projects, projectFilter),
    [projects, projectFilter],
  );

  const listDisplayRows = useMemo(
    () => buildProjectTreeDisplayRows(filteredProjects, listCollapsedIds, listSort),
    [filteredProjects, listCollapsedIds, listSort],
  );

  const toggleListCollapse = (id: number) => {
    setListCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const projectIds = useMemo(
    () => filteredProjectIdSet(projects, projectFilter),
    [projects, projectFilter],
  );

  const filteredGanttProjects = useMemo(
    () => ganttProjects.filter((p) => projectIds.has(p.id)),
    [ganttProjects, projectIds],
  );

  const filteredGanttIssues = useMemo(() => {
    // トラッカー／ステータス／担当者は API 側で絞り込み済み（祖先補完あり）。
    // 未割当を含むときだけ担当者条件をクライアントで OR 判定する。
    const criteria = {
      ...issueFilter,
      trackerIds: [] as (number | string)[],
      statusIds: [] as (number | string)[],
      assignedToIds: issueFilter.includeUnassigned ? issueFilter.assignedToIds : [],
      assignedToGroupIds: issueFilter.includeUnassigned ? issueFilter.assignedToGroupIds : [],
      assignedToGroupMemberIds: [] as (number | string)[],
      includeUnassigned: issueFilter.includeUnassigned === true,
    };
    return filterIssues(filterIssuesByProjectIds(ganttIssues, projectIds), criteria);
  }, [ganttIssues, projectIds, issueFilter]);

  const ganttDisplayProjectCount = useMemo(() => {
    if (showEmptyProjects) return filteredGanttProjects.length;
    const idsWithIssues = new Set(filteredGanttIssues.map((i) => i.projectId));
    return filterProjectsKeepingAncestorsOfTicketed(filteredGanttProjects, idsWithIssues).length;
  }, [showEmptyProjects, filteredGanttProjects, filteredGanttIssues]);

  const kanbanProjectIssues = useMemo(
    () => filterIssuesByProjectIds(kanbanIssues, projectIds),
    [kanbanIssues, projectIds],
  );

  const kanbanFilteredIssues = useMemo(() => {
    const criteria = {
      ...issueFilter,
      trackerIds: [] as (number | string)[],
      statusIds: [] as (number | string)[],
      assignedToIds: issueFilter.includeUnassigned ? issueFilter.assignedToIds : [],
      assignedToGroupIds: issueFilter.includeUnassigned ? issueFilter.assignedToGroupIds : [],
      assignedToGroupMemberIds: [] as (number | string)[],
      includeUnassigned: issueFilter.includeUnassigned === true,
    };
    return filterIssues(kanbanProjectIssues, criteria).filter((issue) => isLeafIssue(issue, kanbanProjectIssues));
  }, [kanbanProjectIssues, issueFilter]);

  const timeFilteredIssues = useMemo(() => {
    const criteria = {
      ...issueFilter,
      trackerIds: [] as (number | string)[],
      statusIds: [] as (number | string)[],
      assignedToIds: issueFilter.includeUnassigned ? issueFilter.assignedToIds : [],
      assignedToGroupIds: issueFilter.includeUnassigned ? issueFilter.assignedToGroupIds : [],
      assignedToGroupMemberIds: [] as (number | string)[],
      includeUnassigned: issueFilter.includeUnassigned === true,
      dueDateStart: '',
      dueDateEnd: '',
    };
    return filterIssues(filterIssuesByProjectIds(timeIssues, projectIds), criteria);
  }, [timeIssues, projectIds, issueFilter]);

  const ganttDisplayIssueCount = filteredGanttIssues.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">プロジェクト</h1>

        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'list'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <List size={15} />
            一覧
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${viewMode === 'gantt'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <BarChart2 size={15} />
            ガントチャート
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${viewMode === 'kanban'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Kanban size={15} />
            カンバン
          </button>
          <button
            onClick={() => setViewMode('time')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${viewMode === 'time'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Clock size={15} />
            時間
          </button>
        </div>
      </div>

      <ProjectListFilterPanel
        viewMode={viewMode}
        companies={companies}
        projectFilter={projectFilter}
        onProjectFilterChange={(patch) => {
          updateProjectFilter(patch);
          setActiveSavedSearchId(null);
        }}
        issueFilter={issueFilter}
        onIssueFilterChange={(patch) => {
          updateIssueFilter(patch);
          setActiveSavedSearchId(null);
        }}
        ganttZoom={ganttZoom}
        ganttStartValue={ganttStartValue}
        onGanttStartValueChange={(v) => { setGanttStartValue(v); setActiveSavedSearchId(null); }}
        ganttEndValue={ganttEndValue}
        onGanttEndValueChange={(v) => { setGanttEndValue(v); setActiveSavedSearchId(null); }}
        showEmptyProjects={showEmptyProjects}
        onShowEmptyProjectsChange={(v) => { setShowEmptyProjects(v); setActiveSavedSearchId(null); }}
        timeRecordDate={timeRecordDate}
        onTimeRecordDateChange={(v) => { setTimeRecordDate(v); setActiveSavedSearchId(null); }}
        timeRecordFilterUserIds={timeRecordFilterUserIds}
        onTimeRecordFilterUserIdsChange={(v) => { setTimeRecordFilterUserIds(v); setActiveSavedSearchId(null); }}
        onResetAll={resetAllFilters}
        projectCount={viewMode === 'gantt' ? ganttDisplayProjectCount : filteredProjects.length}
        issueCount={
          viewMode === 'gantt'
            ? ganttDisplayIssueCount
            : viewMode === 'kanban'
              ? kanbanFilteredIssues.length
              : viewMode === 'time'
                ? timeFilteredIssues.length
                : undefined
        }
        entryCount={viewMode === 'time' ? timeEntries.length : undefined}
        onNewProjectClick={openCreateProjectModal}
        onSortClick={() => setShowSortModal(true)}
        onIssueSortClick={() => setShowIssueSortModal(true)}
        listSort={listSort}
        issueSort={issueSort}
        activeSavedSearchId={activeSavedSearchId}
        onLoadSavedSearch={applyFilter}
        savedSearches={savedSearches}
        onReloadSavedSearches={reloadSavedSearches}
      />

      {viewMode === 'list' && (
        <div className="bg-white rounded-lg shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">プロジェクト名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">識別子</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">期限</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">チケット数</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {listDisplayRows.map(({ project, depth, hasChildren }) => (
                <tr
                  key={project.id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center min-w-0"
                      style={depth > 0 ? { paddingLeft: depth * 20 } : undefined}
                      title={project.company?.name ? `${project.company.name} / ${project.name}` : project.name}
                    >
                      <span className="w-5 flex-shrink-0 flex items-center justify-center mr-0.5">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleListCollapse(project.id);
                            }}
                            className="p-0.5 text-gray-500 hover:text-gray-800 rounded"
                            title={listCollapsedIds.has(project.id) ? '展開' : '折りたたむ'}
                            aria-expanded={!listCollapsedIds.has(project.id)}
                          >
                            {listCollapsedIds.has(project.id) ? (
                              <ChevronRight size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5" />
                        )}
                      </span>
                      <span
                        className={`text-sky-600 truncate min-w-0 ${
                          hasChildren ? 'font-semibold' : 'font-medium'
                        }`}
                      >
                        {project.company?.name && (
                          <span className="text-slate-500 font-normal">{project.company.name} / </span>
                        )}
                        {project.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{project.identifier}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {project.dueDate ? new Date(project.dueDate).toLocaleDateString('ja-JP') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{project._count?.issues || 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${project.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : project.status === 'closed'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                        }`}
                    >
                      {project.status === 'active' ? '有効' : project.status === 'closed' ? '終了' : 'アーカイブ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && (
            <div className="text-center py-8 text-gray-500">プロジェクトが登録されていません</div>
          )}
          {projects.length > 0 && filteredProjects.length === 0 && (
            <div className="text-center py-8 text-gray-500">条件に一致するプロジェクトがありません</div>
          )}
        </div>
      )}

      {viewMode === 'gantt' && (
        <GanttChart
          issues={filteredGanttIssues}
          projects={filteredGanttProjects}
          showProject
          showEmptyProjects={showEmptyProjects}
          projectSort={listSort}
          issueSort={issueSort}
          systemSettings={systemSettings}
          onUpdateIssue={handleUpdateIssue}
          onIssueCreated={loadGanttData}
          onRelationCreated={handleCreateRelation}
          zoom={ganttZoom}
          onZoomChange={setGanttZoom}
          startValue={ganttStartValue}
          onStartValueChange={setGanttStartValue}
          endValue={ganttEndValue}
          onEndValueChange={setGanttEndValue}
          filterTrackerIds={[]}
          filterStatusIds={[]}
          filterAssignedToIds={issueFilter.includeUnassigned ? issueFilter.assignedToIds : []}
          filterAssignedToGroupIds={issueFilter.includeUnassigned ? issueFilter.assignedToGroupIds : []}
          filterAssignedToGroupMemberIds={[]}
          filterIncludeUnassigned={issueFilter.includeUnassigned}
          collapsedProjects={ganttCollapsedProjects}
          onCollapsedProjectsChange={setGanttCollapsedProjects}
        />
      )}

      {viewMode === 'kanban' && (
        <KanbanBoard
          statuses={kanbanStatuses}
          issues={kanbanFilteredIssues}
          hierarchyIssues={kanbanProjectIssues}
          onDrop={handleKanbanDrop}
          onIssueClick={handleIssueClick}
          showProjectName={true}
          issueSort={issueSort}
        />
      )}

      {viewMode === 'time' && (
        <TimeRecordTree
          projects={filteredProjects}
          issues={timeFilteredIssues}
          statuses={timeStatuses}
          timeEntries={timeEntries}
          permissionsByProject={timePermByProject}
          workflowByProject={timeWorkflowByProject}
          onIssuesChange={setTimeIssues}
          onTimeEntriesChange={setTimeEntries}
          projectSort={listSort}
          issueSort={issueSort}
        />
      )}

      <ProjectListSortModal
        isOpen={showSortModal}
        onClose={() => setShowSortModal(false)}
        value={listSort}
        onApply={(sort) => {
          setListSort(sort);
          setActiveSavedSearchId(null);
        }}
      />

      <IssueListSortModal
        isOpen={showIssueSortModal}
        onClose={() => setShowIssueSortModal(false)}
        value={issueSort}
        onApply={(sort) => {
          setIssueSort(sort);
          setActiveSavedSearchId(null);
        }}
      />

      <Modal
        isOpen={showProjectModal}
        onClose={closeProjectModal}
        title={editingProjectId ? 'プロジェクト情報編集' : 'プロジェクト登録'}
        footer={
          <>
            <button
              type="button"
              onClick={closeProjectModal}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
            >
              キャンセル
            </button>
            <button type="submit" form="project-list-form" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              {editingProjectId ? '更新' : '作成'}
            </button>
          </>
        }
      >
        {projectError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{projectError}</div>}
        <ProjectCreateForm
          formId="project-list-form"
          values={projectForm}
          onChange={patchProjectForm}
          onSubmit={handleSubmitProject}
          companies={companies}
          projects={projects}
          excludeProjectId={editingProjectId}
        />
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={closeIssueModal} title="チケット詳細">
        {isDetailModalOpen && selectedIssueId && user && (
          <IssueDetail
            issueId={String(selectedIssueId)}
            user={user}
            onEdit={handleEditFromDetail}
          />
        )}
      </Modal>

      {selectedIssueId && (
        <IssueFormModal
          isOpen={isEditModalOpen}
          onClose={closeIssueModal}
          title="チケット編集"
          issueId={String(selectedIssueId)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            loadKanbanData();
            setIsDetailModalOpen(true);
          }}
          onCancel={() => {
            setIsEditModalOpen(false);
            setIsDetailModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
