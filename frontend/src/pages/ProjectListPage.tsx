import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { List, BarChart2, Kanban, Clock, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import api from '../api/client';
import { Project, Company, Issue, IssueStatus, TimeEntry, SavedSearch } from '../types';
import Modal from '../components/Modal';
import GanttChart from '../components/GanttChart';
import ProjectListFilterPanel from '../components/ProjectListFilterPanel';
import ProjectListSortModal from '../components/ProjectListSortModal';
import KanbanBoard from '../components/KanbanBoard';
import IssueDetail from '../components/IssueDetail';
import { IssueFormModal } from '../components/IssueForm';
import Combobox from '../components/Combobox';
import TextInput from '../components/TextInput';
import DateInput from '../components/DateInput';
import TimeRecordTree from '../components/TimeRecordTree';
import { useAuth } from '../hooks/useAuth';
import { useProjectListFilters } from '../hooks/useProjectListFilters';
import { filterProjects, filteredProjectIdSet } from '../utils/projectFilter';
import { filterIssues, filterIssuesByProjectIds } from '../utils/issueFilter';
import { isLeafIssue } from '../utils/issueTree';
import {
  buildProjectTreeDisplayRows,
  filterProjectsKeepingAncestorsOfTicketed,
  getProjectSelectLabelParts,
  PROJECT_LIST_SORT_OPTIONS,
  createSortEntry,
  isOptionalSortKey,
  type ProjectListEmptyPlacement,
  type ProjectListSort,
  type ProjectListSortDirection,
  type ProjectListSortKey,
} from '../utils/projectTree';
import type { ProjectListViewMode } from '../utils/projectListStorage';
import { generateIdentifier } from '../utils/format';
import {
  effectiveDateRange,
  isDateRangeRelativePreset,
  resolveRelativeDateRange,
  type DateRangeRelativePreset,
  type DateRangeSpecifyMode,
} from '../utils/dateRangeSpecify';
import type { DateRangeSpecifyValue } from '../components/DateRangeSpecify';

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

  const [kanbanIssues, setKanbanIssues] = useState<Issue[]>([]);
  const [kanbanStatuses, setKanbanStatuses] = useState<IssueStatus[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { user } = useAuth();

  // 保存済み検索
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<number | null>(null);

  const [timeIssues, setTimeIssues] = useState<Issue[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeRecordDate, setTimeRecordDate] = useState<DateRangeSpecifyValue>({
    mode: 'direct',
    relative: '',
    start: '',
    end: '',
  });
  const [timeRecordFilterUserIds, setTimeRecordFilterUserIds] = useState<(number | string)[]>([]);
  const prevViewModeRef = useRef<ProjectListViewMode | null>(null);
  const timeDefaultsUserIdRef = useRef<number | null>(null);

  const applyTimeViewDefaults = useCallback(() => {
    if (!user) return;
    updateIssueFilter({
      assignedToIds: [],
      assignedToGroupIds: [],
      assignedToGroupMemberIds: [],
      dueDateStart: '',
      dueDateEnd: '',
      dueDateMode: 'direct',
      dueDateRelative: '',
      scheduleDateStart: '',
      scheduleDateEnd: '',
      scheduleDateMode: 'direct',
      scheduleDateRelative: '',
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
          if (viewMode === 'time') {
            next.dueDateStart = '';
            next.dueDateEnd = '';
            next.dueDateMode = 'direct';
            next.dueDateRelative = '';
          } else {
            next.scheduleDateStart = '';
            next.scheduleDateEnd = '';
            next.scheduleDateMode = 'direct';
            next.scheduleDateRelative = '';
          }
          if (viewMode !== 'time') {
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
          if (viewMode === 'time') {
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
      setActiveSavedSearchId(search.id);
    },
    [setProjectFilter, setIssueFilter, setGanttZoom, setShowEmptyProjects, setListSort, viewMode],
  );

  /** 保存済み検索のデフォルトを自動適用（表示モード切替時）。古い応答は破棄する */
  const savedSearchRequestGenRef = useRef(0);
  const applyDefaultSavedSearch = useCallback(
    async (mode: ProjectListViewMode) => {
      const gen = ++savedSearchRequestGenRef.current;
      try {
        const res = await api.get('/saved-searches', { params: { viewMode: mode } });
        if (gen !== savedSearchRequestGenRef.current) return;
        const list: SavedSearch[] = res.data;
        const def = list.find((s) => s.isDefault);
        if (def) applyFilter(def);
      } catch {
        // 接続エラーは無視
      }
    },
    [applyFilter],
  );

  // ビュー切替時: 条件リセット → デフォルト保存済み検索を適用
  // ※ 時間タブ初期値エフェクトより先に定義することで、React のエフェクト実行順（定義順）に従い
  //   このリセットが先に走り、その後に時間タブ初期値が上書きされる形になる
  // ※ 時間タブの担当者初期値がガント等に残らないよう、切替時は必ず issueFilter をリセットする
  const prevViewModeForSavedRef = useRef<ProjectListViewMode | null>(null);
  useEffect(() => {
    if (prevViewModeForSavedRef.current === viewMode) return;
    prevViewModeForSavedRef.current = viewMode;
    savedSearchRequestGenRef.current += 1;
    resetProjectFilter();
    resetIssueFilter();
    setActiveSavedSearchId(null);
    applyDefaultSavedSearch(viewMode);
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
        dueDateStart: '',
        dueDateEnd: '',
        dueDateMode: 'direct',
        dueDateRelative: '',
        scheduleDateStart: '',
        scheduleDateEnd: '',
        scheduleDateMode: 'direct',
        scheduleDateRelative: '',
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
  const [projectName, setProjectName] = useState('');
  const [projectIdentifier, setProjectIdentifier] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCompanyId, setProjectCompanyId] = useState('');
  const [projectParentId, setProjectParentId] = useState('');
  const [projectDueDate, setProjectDueDate] = useState('');
  const [projectError, setProjectError] = useState('');

  const loadProjects = () => {
    api.get('/projects').then((res) => setProjects(res.data));
  };

  const loadCompanies = () => {
    api.get('/companies').then((res) => setCompanies(res.data));
  };

  const loadGanttData = useCallback(() => {
    api.get('/gantt/all').then((res) => {
      setGanttProjects(res.data.projects);
      setGanttIssues(res.data.issues);
    });
    api.get('/settings/calendar').then((res) => {
      setSystemSettings(res.data);
    }).catch(() => {});
  }, []);

  const loadKanbanData = useCallback(() => {
    Promise.all([
      api.get('/issues'),
      api.get('/issues/meta/options'),
    ]).then(([issuesRes, metaRes]) => {
      setKanbanIssues(issuesRes.data);
      setKanbanStatuses(metaRes.data.statuses);
    });
  }, []);

  const loadTimeData = useCallback(() => {
    const issueParams: Record<string, string | number> = {};
    if (issueFilter.trackerIds.length > 0) issueParams.trackerIds = issueFilter.trackerIds.join(',');
    if (issueFilter.statusIds.length > 0) issueParams.statusIds = issueFilter.statusIds.join(',');
    if (issueFilter.assignedToIds.length > 0) {
      issueParams.assignedToIds = issueFilter.assignedToIds.join(',');
    }

    const recordRange = effectiveDateRange(
      timeRecordDate.mode,
      timeRecordDate.relative,
      timeRecordDate.start,
      timeRecordDate.end,
    );
    const entryParams: Record<string, string | number> = {};
    if (recordRange.start) entryParams.startDate = recordRange.start;
    if (recordRange.end) entryParams.endDate = recordRange.end;
    if (timeRecordFilterUserIds.length > 0) {
      entryParams.userIds = timeRecordFilterUserIds.join(',');
    }

    Promise.all([
      api.get('/issues', { params: issueParams }),
      api.get('/time-entries', { params: entryParams }),
    ]).then(([issuesRes, entriesRes]) => {
      setTimeIssues(issuesRes.data);
      setTimeEntries(entriesRes.data);
    });
  }, [
    issueFilter.trackerIds,
    issueFilter.statusIds,
    issueFilter.assignedToIds,
    timeRecordDate,
    timeRecordFilterUserIds,
  ]);

  useEffect(() => {
    loadProjects();
    loadCompanies();
  }, []);

  useEffect(() => {
    if (viewMode === 'gantt') loadGanttData();
    if (viewMode === 'kanban') loadKanbanData();
    if (viewMode === 'time') loadTimeData();
  }, [viewMode, loadGanttData, loadKanbanData, loadTimeData]);

  const openCreateProjectModal = () => {
    setEditingProjectId(null);
    setProjectName('');
    setProjectIdentifier(generateIdentifier());
    setProjectDescription('');
    setProjectCompanyId('');
    setProjectParentId('');
    setProjectDueDate('');
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
      const data = {
        name: projectName,
        identifier: projectIdentifier,
        description: projectDescription || null,
        companyId: projectCompanyId ? Number(projectCompanyId) : null,
        parentId: projectParentId ? Number(projectParentId) : null,
        dueDate: projectDueDate || null,
      };
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
    } catch {
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

  const filteredGanttIssues = useMemo(
    () => filterIssues(filterIssuesByProjectIds(ganttIssues, projectIds), issueFilter),
    [ganttIssues, projectIds, issueFilter],
  );

  const ganttDisplayProjectCount = useMemo(() => {
    if (showEmptyProjects) return filteredGanttProjects.length;
    const idsWithIssues = new Set(filteredGanttIssues.map((i) => i.projectId));
    return filterProjectsKeepingAncestorsOfTicketed(filteredGanttProjects, idsWithIssues).length;
  }, [showEmptyProjects, filteredGanttProjects, filteredGanttIssues]);

  const kanbanProjectIssues = useMemo(
    () => filterIssuesByProjectIds(kanbanIssues, projectIds),
    [kanbanIssues, projectIds],
  );

  const kanbanFilteredIssues = useMemo(
    () => filterIssues(kanbanProjectIssues, issueFilter).filter((issue) => isLeafIssue(issue, kanbanProjectIssues)),
    [kanbanProjectIssues, issueFilter],
  );

  const timeFilteredIssues = useMemo(() => {
    const criteria = {
      ...issueFilter,
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
        listSort={listSort}
        activeSavedSearchId={activeSavedSearchId}
        onLoadSavedSearch={applyFilter}
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
          filterTrackerIds={issueFilter.trackerIds}
          onFilterTrackerIdsChange={(values) => { updateIssueFilter({ trackerIds: values }); setActiveSavedSearchId(null); }}
          filterStatusIds={issueFilter.statusIds}
          onFilterStatusIdsChange={(values) => { updateIssueFilter({ statusIds: values }); setActiveSavedSearchId(null); }}
          filterAssignedToIds={issueFilter.assignedToIds}
          onFilterAssignedToIdsChange={(values) => { updateIssueFilter({ assignedToIds: values }); setActiveSavedSearchId(null); }}
          filterAssignedToGroupIds={issueFilter.assignedToGroupIds}
          filterAssignedToGroupMemberIds={issueFilter.assignedToGroupMemberIds}
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
        />
      )}

      {viewMode === 'time' && (
        <TimeRecordTree
          projects={filteredProjects}
          issues={timeFilteredIssues}
          timeEntries={timeEntries}
          onRefresh={loadTimeData}
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
        <form id="project-list-form" onSubmit={handleSubmitProject}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <TextInput
              label="プロジェクト名 *"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
            <TextInput
              label="識別子 *"
              value={projectIdentifier}
              onChange={(e) => setProjectIdentifier(e.target.value)}
              required
              pattern="[a-z0-9-]+"
              title="小文字英数字とハイフンのみ"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setProjectIdentifier(generateIdentifier())}
                  className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="識別子を再生成"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Combobox
                label="企業"
                options={[
                  { value: '', label: 'なし' },
                  ...companies.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
                value={projectCompanyId}
                onChange={setProjectCompanyId}
                size="medium"
              />
            </div>
            <div>
              <Combobox
                label="親プロジェクト"
                options={[
                  { value: '', label: 'なし' },
                  ...projects
                    .filter((p) => p.id !== editingProjectId)
                    .map((p) => {
                      const { primary, secondary } = getProjectSelectLabelParts(p, projects);
                      return {
                        value: String(p.id),
                        label: primary,
                        secondaryLabel: secondary || undefined,
                      };
                    }),
                ]}
                value={projectParentId}
                onChange={(val) => {
                  setProjectParentId(val);
                  if (val) {
                    const parent = projects.find((p) => String(p.id) === val);
                    if (parent?.dueDate) {
                      setProjectDueDate(parent.dueDate.slice(0, 10));
                    }
                  }
                }}
                size="medium"
              />
            </div>
          </div>
          <div className="mb-4">
            <DateInput
              label="期限日"
              id="project-due-date"
              value={projectDueDate}
              onChange={setProjectDueDate}
            />
          </div>
          <div className="mb-4">
            <TextInput
              label="説明"
              isMultiline
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              rows={3}
            />
          </div>
        </form>
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
          permissions={user?.permissions}
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
