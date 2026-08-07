import { useEffect, useMemo, useState } from 'react';
import { Search, X, ArrowUpDown } from 'lucide-react';
import api from '../api/client';
import { Company, IssueStatus, Tracker, SavedSearch } from '../types';
import { SELF_COMPANY_FILTER_VALUE, type ProjectFilterCriteria } from '../utils/projectFilter';
import type { IssueFilterCriteria } from '../utils/issueFilter';
import { UNASSIGNED_ASSIGNEE_VALUE } from '../utils/issueFilter';
import type { ProjectListViewMode } from '../utils/projectListStorage';
import type { ProjectListSort } from '../utils/projectTree';
import type { IssueListSort } from '../utils/issueSort';
import Combobox, { type ComboboxOption } from './Combobox';
import TextInput from './TextInput';
import CustomDatePicker from './CustomDatePicker';
import SavedSearchDropdown from './SavedSearchDropdown';
import DateRangeSpecify, { type DateRangeSpecifyValue } from './DateRangeSpecify';
import { formatDateToYYYYMMDD } from '../utils/format';
import { toSavedDateRangeFields } from '../utils/dateRangeSpecify';
import {
  buildGroupedUserOptions,
  splitGroupedAssigneeSelection,
  UNGROUPED_OPTION_VALUE,
} from '../utils/groupedUserOptions';

interface ProjectListFilterPanelProps {
  viewMode: ProjectListViewMode;
  companies: Company[];
  projectFilter: ProjectFilterCriteria;
  onProjectFilterChange: (patch: Partial<ProjectFilterCriteria>) => void;
  issueFilter: IssueFilterCriteria;
  onIssueFilterChange: (patch: Partial<IssueFilterCriteria>) => void;
  ganttZoom: 'day' | 'month' | 'year';
  ganttStartValue: string;
  onGanttStartValueChange: (value: string) => void;
  ganttEndValue: string;
  onGanttEndValueChange: (value: string) => void;
  showEmptyProjects: boolean;
  onShowEmptyProjectsChange: (value: boolean) => void;
  timeRecordDate: DateRangeSpecifyValue;
  onTimeRecordDateChange: (value: DateRangeSpecifyValue) => void;
  timeRecordFilterUserIds: (number | string)[];
  onTimeRecordFilterUserIdsChange: (values: (number | string)[]) => void;
  onResetAll: () => void;
  projectCount: number;
  issueCount?: number;
  entryCount?: number;
  onNewProjectClick: () => void;
  /** 一覧／ガント／時間のプロジェクト並び替えモーダルを開く */
  onSortClick?: () => void;
  /** ガント／カンバン／時間のチケット並び替えモーダルを開く */
  onIssueSortClick?: () => void;
  /** 一覧の並び替え条件（保存済み検索に含める） */
  listSort: ProjectListSort[];
  /** チケットの並び替え条件（保存済み検索に含める） */
  issueSort: IssueListSort[];
  /** 保存済み検索: 現在アクティブな ID */
  activeSavedSearchId: number | null;
  /** 保存済み検索をロードしたときのコールバック */
  onLoadSavedSearch: (search: SavedSearch) => void;
  /** 保存済み検索一覧（ページ側で取得して共有） */
  savedSearches: SavedSearch[];
  /** 保存済み検索一覧の再取得（保存・削除・デフォルト変更後） */
  onReloadSavedSearches: () => Promise<void> | void;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <span className="text-xs font-medium text-slate-500 w-[4.5rem] shrink-0 pt-2">{label}</span>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function getGanttDefaultRange(zoom: 'day' | 'month' | 'year') {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (zoom === 'day') {
    return {
      start: formatDateToYYYYMMDD(new Date(currentYear, currentMonth, 1)),
      end: formatDateToYYYYMMDD(new Date(currentYear, currentMonth + 6, 0)),
    };
  }
  if (zoom === 'month') {
    const endMonth = currentMonth + 11;
    const endYear = currentYear + Math.floor(endMonth / 12);
    const endMonthNum = (endMonth % 12) + 1;
    return {
      start: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      end: `${endYear}-${String(endMonthNum).padStart(2, '0')}`,
    };
  }
  return { start: `${currentYear}`, end: `${currentYear + 9}` };
}

export default function ProjectListFilterPanel({
  viewMode,
  companies,
  projectFilter,
  onProjectFilterChange,
  issueFilter,
  onIssueFilterChange,
  ganttZoom,
  ganttStartValue,
  onGanttStartValueChange,
  ganttEndValue,
  onGanttEndValueChange,
  showEmptyProjects,
  onShowEmptyProjectsChange,
  timeRecordDate,
  onTimeRecordDateChange,
  timeRecordFilterUserIds,
  onTimeRecordFilterUserIdsChange,
  onResetAll,
  projectCount,
  issueCount,
  entryCount,
  onNewProjectClick,
  onSortClick,
  onIssueSortClick,
  listSort,
  issueSort,
  activeSavedSearchId,
  onLoadSavedSearch,
  savedSearches,
  onReloadSavedSearches,
}: ProjectListFilterPanelProps) {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [users, setUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string; members: { userId: number }[] }[]>([]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => {
      setTrackers(res.data.trackers);
      setStatuses(res.data.statuses);
      setUsers(res.data.users);
      setGroups(res.data.groups ?? []);
    });
  }, []);

  const groupedUserOptions = useMemo(
    (): ComboboxOption[] => buildGroupedUserOptions({ users, groups }),
    [users, groups],
  );

  const issueAssigneeOptions = useMemo(
    (): ComboboxOption[] => [
      { value: UNASSIGNED_ASSIGNEE_VALUE, label: '未割当', divider: true },
      ...groupedUserOptions,
    ],
    [groupedUserOptions],
  );

  const showTicketFilters = viewMode !== 'list';
  const showTicketDueDateFilter = showTicketFilters && viewMode !== 'time';
  const showTicketScheduleFilter = showTicketFilters;
  const showGanttRange = viewMode === 'gantt';
  const showTimeRecordFilters = viewMode === 'time';

  const handleGanttStartChange = (value: string) => {
    if (value === '') {
      onGanttStartValueChange(getGanttDefaultRange(ganttZoom).start);
    } else {
      onGanttStartValueChange(value);
    }
  };

  const handleGanttEndChange = (value: string) => {
    if (value === '') {
      onGanttEndValueChange(getGanttDefaultRange(ganttZoom).end);
    } else {
      onGanttEndValueChange(value);
    }
  };

  const hasActiveFilter =
    projectFilter.searchQuery.trim() !== '' ||
    projectFilter.dueDateStart !== '' ||
    projectFilter.dueDateEnd !== '' ||
    projectFilter.dueDateMode === 'relative' ||
    projectFilter.companyIds.length > 0 ||
    projectFilter.statuses.length > 0 ||
    projectFilter.memberIds.length > 0 ||
    projectFilter.memberGroupIds.length > 0 ||
    issueFilter.trackerIds.length > 0 ||
    issueFilter.statusIds.length > 0 ||
    issueFilter.assignedToIds.length > 0 ||
    issueFilter.assignedToGroupIds.length > 0 ||
    issueFilter.includeUnassigned ||
    (showTicketScheduleFilter && issueFilter.includeUnscheduled) ||
    (showTicketDueDateFilter &&
      (issueFilter.dueDateMode === 'relative' ||
        issueFilter.dueDateStart !== '' ||
        issueFilter.dueDateEnd !== '')) ||
    (showTicketScheduleFilter &&
      (issueFilter.scheduleDateMode === 'relative' ||
        issueFilter.scheduleDateStart !== '' ||
        issueFilter.scheduleDateEnd !== '')) ||
    ganttStartValue !== '' ||
    ganttEndValue !== '' ||
    timeRecordDate.start !== '' ||
    timeRecordDate.end !== '' ||
    timeRecordDate.mode === 'relative' ||
    timeRecordFilterUserIds.length > 0;

  const ganttRangePickers = ganttZoom === 'year' ? (
    <>
      <CustomDatePicker
        value={ganttStartValue}
        onChange={handleGanttStartChange}
        size="small"
        showFloatingLabel={false}
        placeholder="開始"
        className="w-36"
        selectMode="year"
      />
      <span className="text-gray-400 text-xs">〜</span>
      <CustomDatePicker
        value={ganttEndValue}
        onChange={handleGanttEndChange}
        size="small"
        showFloatingLabel={false}
        placeholder="終了"
        className="w-36"
        selectMode="year"
      />
    </>
  ) : ganttZoom === 'month' ? (
    <>
      <CustomDatePicker
        value={ganttStartValue}
        onChange={handleGanttStartChange}
        size="small"
        showFloatingLabel={false}
        placeholder="開始"
        className="w-48"
        selectMode="month"
      />
      <span className="text-gray-400 text-xs">〜</span>
      <CustomDatePicker
        value={ganttEndValue}
        onChange={handleGanttEndChange}
        size="small"
        showFloatingLabel={false}
        placeholder="終了"
        className="w-48"
        selectMode="month"
      />
    </>
  ) : (
    <>
      <CustomDatePicker
        value={ganttStartValue}
        onChange={handleGanttStartChange}
        size="small"
        showFloatingLabel={false}
        placeholder="開始"
        className="w-48"
      />
      <span className="text-gray-400 text-xs">〜</span>
      <CustomDatePicker
        value={ganttEndValue}
        onChange={handleGanttEndChange}
        size="small"
        showFloatingLabel={false}
        placeholder="終了"
        className="w-48"
      />
    </>
  );

  const projectDueSaved = toSavedDateRangeFields(
    projectFilter.dueDateMode,
    projectFilter.dueDateRelative,
    projectFilter.dueDateStart,
    projectFilter.dueDateEnd,
  );
  const issueDueSaved = showTicketDueDateFilter
    ? toSavedDateRangeFields(
        issueFilter.dueDateMode,
        issueFilter.dueDateRelative,
        issueFilter.dueDateStart,
        issueFilter.dueDateEnd,
      )
    : null;
  const scheduleSaved = showTicketScheduleFilter
    ? toSavedDateRangeFields(
        issueFilter.scheduleDateMode,
        issueFilter.scheduleDateRelative,
        issueFilter.scheduleDateStart,
        issueFilter.scheduleDateEnd,
      )
    : null;
  const timeRecordSaved = showTimeRecordFilters
    ? toSavedDateRangeFields(
        timeRecordDate.mode,
        timeRecordDate.relative,
        timeRecordDate.start,
        timeRecordDate.end,
      )
    : null;

  const currentFilter: SavedSearch['filter'] = {
    projectFilter: {
      searchQuery: projectFilter.searchQuery,
      companyIds: projectFilter.companyIds,
      statuses: projectFilter.statuses,
      memberIds: projectFilter.memberIds,
      memberGroupIds: projectFilter.memberGroupIds,
      memberGroupMemberIds: projectFilter.memberGroupMemberIds,
      dueDateMode: projectDueSaved.mode,
      dueDateRelative: projectDueSaved.relative,
      ...(projectDueSaved.start !== undefined
        ? { dueDateStart: projectDueSaved.start, dueDateEnd: projectDueSaved.end ?? '' }
        : {}),
    },
    issueFilter: {
      trackerIds: issueFilter.trackerIds,
      statusIds: issueFilter.statusIds,
      assignedToIds: issueFilter.assignedToIds,
      assignedToGroupIds: issueFilter.assignedToGroupIds,
      assignedToGroupMemberIds: issueFilter.assignedToGroupMemberIds,
      includeUnassigned: issueFilter.includeUnassigned,
      includeUnscheduled: issueFilter.includeUnscheduled,
      ...(issueDueSaved
        ? {
            dueDateMode: issueDueSaved.mode,
            dueDateRelative: issueDueSaved.relative,
            ...(issueDueSaved.start !== undefined
              ? { dueDateStart: issueDueSaved.start, dueDateEnd: issueDueSaved.end ?? '' }
              : {}),
          }
        : {}),
      ...(scheduleSaved
        ? {
            scheduleDateMode: scheduleSaved.mode,
            scheduleDateRelative: scheduleSaved.relative,
            ...(scheduleSaved.start !== undefined
              ? {
                  scheduleDateStart: scheduleSaved.start,
                  scheduleDateEnd: scheduleSaved.end ?? '',
                }
              : {}),
          }
        : {}),
    },
    ganttZoom,
    showEmptyProjects,
    ...(timeRecordSaved
      ? {
          timeRecordDateMode: timeRecordSaved.mode,
          timeRecordDateRelative: timeRecordSaved.relative,
          ...(timeRecordSaved.start !== undefined
            ? {
                timeRecordStartDate: timeRecordSaved.start,
                timeRecordEndDate: timeRecordSaved.end ?? '',
              }
            : {}),
        }
      : {}),
    timeRecordFilterUserIds,
    listSort,
    issueSort,
  };

  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <div className="flex flex-wrap items-center gap-3 p-3 border-b border-gray-100">
        <div className="relative flex-1 min-w-[300px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <TextInput
            placeholder="プロジェクト名、識別子、説明、企業名..."
            value={projectFilter.searchQuery}
            onChange={(e) => onProjectFilterChange({ searchQuery: e.target.value })}
            size="small"
            showFloatingLabel={false}
            className="pl-9 w-full"
          />
        </div>
        <SavedSearchDropdown
          viewMode={viewMode}
          activeId={activeSavedSearchId}
          currentFilter={currentFilter}
          onLoad={onLoadSavedSearch}
          searches={savedSearches}
          onReload={onReloadSavedSearches}
        />
        <button
          type="button"
          onClick={onNewProjectClick}
          className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm shadow-sm transition-all whitespace-nowrap shrink-0"
        >
          新規プロジェクト
        </button>
      </div>

      <div className="p-3 space-y-3">
        <FilterRow label="プロジェクト">
          {(viewMode === 'list' || viewMode === 'gantt' || viewMode === 'time') && onSortClick && (
            <button
              type="button"
              onClick={onSortClick}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 min-h-[32px] whitespace-nowrap shrink-0"
            >
              <ArrowUpDown size={12} />
              並び替え
            </button>
          )}
          <DateRangeSpecify
            label="期限日"
            value={{
              mode: projectFilter.dueDateMode,
              relative: projectFilter.dueDateRelative,
              start: projectFilter.dueDateStart,
              end: projectFilter.dueDateEnd,
            }}
            onChange={(next) =>
              onProjectFilterChange({
                dueDateMode: next.mode,
                dueDateRelative: next.relative,
                dueDateStart: next.start,
                dueDateEnd: next.end,
              })
            }
          />
          <Combobox
            label="ステータス"
            options={[
              { value: 'active', label: '有効' },
              { value: 'closed', label: '終了' },
              { value: 'archived', label: 'アーカイブ' },
            ]}
            value={projectFilter.statuses}
            onChange={(values) => onProjectFilterChange({ statuses: values as string[] })}
            placeholder="全て"
            className="w-[13.5rem]"
            isMulti={true}
            size="small"
          />
          <Combobox
            label="企業"
            options={[
              { value: SELF_COMPANY_FILTER_VALUE, label: '自社', divider: true },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={projectFilter.companyIds}
            onChange={(values) => onProjectFilterChange({ companyIds: values })}
            placeholder="全企業"
            className="w-[21rem]"
            isMulti={true}
            size="small"
          />
          <Combobox
            label="メンバー"
            value={[
              ...projectFilter.memberIds.map((id) => String(id)),
              ...projectFilter.memberGroupIds.map((id) => `g:${id}`),
            ]}
            options={groupedUserOptions}
            onChange={(values: (string | number)[]) => {
              const { userIds, groupIds, memberIds } = splitGroupedAssigneeSelection(values, groups);
              onProjectFilterChange({
                memberIds: userIds,
                memberGroupIds: groupIds,
                memberGroupMemberIds: memberIds,
              });
            }}
            placeholder="全員"
            isMulti={true}
            size="small"
            className="w-[16.5rem]"
          />
        </FilterRow>

        {showTicketFilters && (
          <FilterRow label="チケット">
            {onIssueSortClick && (
              <button
                type="button"
                onClick={onIssueSortClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 min-h-[32px] whitespace-nowrap shrink-0"
              >
                <ArrowUpDown size={12} />
                並び替え
              </button>
            )}
            {showTicketDueDateFilter && (
              <DateRangeSpecify
                label="期限"
                value={{
                  mode: issueFilter.dueDateMode,
                  relative: issueFilter.dueDateRelative,
                  start: issueFilter.dueDateStart,
                  end: issueFilter.dueDateEnd,
                }}
                onChange={(next) =>
                  onIssueFilterChange({
                    dueDateMode: next.mode,
                    dueDateRelative: next.relative,
                    dueDateStart: next.start,
                    dueDateEnd: next.end,
                  })
                }
              />
            )}
            {showTicketScheduleFilter && (
              <>
                <DateRangeSpecify
                  label="開始・終了"
                  value={{
                    mode: issueFilter.scheduleDateMode,
                    relative: issueFilter.scheduleDateRelative,
                    start: issueFilter.scheduleDateStart,
                    end: issueFilter.scheduleDateEnd,
                  }}
                  onChange={(next) =>
                    onIssueFilterChange({
                      scheduleDateMode: next.mode,
                      scheduleDateRelative: next.relative,
                      scheduleDateStart: next.start,
                      scheduleDateEnd: next.end,
                    })
                  }
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={issueFilter.includeUnscheduled}
                    onChange={(e) => onIssueFilterChange({ includeUnscheduled: e.target.checked })}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-600">開始・終了未設定を含む</span>
                </label>
              </>
            )}
            <Combobox
              label="トラッカー"
              value={issueFilter.trackerIds}
              options={trackers.map((t) => ({ value: t.id.toString(), label: t.name }))}
              onChange={(values) => onIssueFilterChange({ trackerIds: values })}
              placeholder="全て"
              isMulti={true}
              size="small"
              className="w-[13.5rem]"
            />
            <Combobox
              label="ステータス"
              value={issueFilter.statusIds}
              options={statuses.map((s) => ({ value: s.id.toString(), label: s.name }))}
              onChange={(values) => onIssueFilterChange({ statusIds: values })}
              placeholder="全て"
              isMulti={true}
              size="small"
              className="w-[13.5rem]"
            />
            <Combobox
              label="担当者"
              value={[
                ...(issueFilter.includeUnassigned ? [UNASSIGNED_ASSIGNEE_VALUE] : []),
                ...issueFilter.assignedToIds.map((id) => String(id)),
                ...issueFilter.assignedToGroupIds.map((id) => `g:${id}`),
              ]}
              options={issueAssigneeOptions}
              onChange={(values: (string | number)[]) => {
                const includeUnassigned = values.some((v) => String(v) === UNASSIGNED_ASSIGNEE_VALUE);
                const { userIds, groupIds } = splitGroupedAssigneeSelection(
                  values.filter((v) => String(v) !== UNASSIGNED_ASSIGNEE_VALUE),
                  groups,
                );
                onIssueFilterChange({
                  assignedToIds: userIds,
                  assignedToGroupIds: groupIds,
                  assignedToGroupMemberIds: [],
                  includeUnassigned,
                });
              }}
              placeholder="全員"
              isMulti={true}
              size="small"
              className="w-[16.5rem]"
            />
          </FilterRow>
        )}

        {showGanttRange && (
          <FilterRow label="ガント">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 shrink-0">表示期間</span>
              {ganttRangePickers}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEmptyProjects}
                onChange={(e) => onShowEmptyProjectsChange(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-600">チケットなしのプロジェクトを表示</span>
            </label>
          </FilterRow>
        )}

        {showTimeRecordFilters && (
          <FilterRow label="時間記録">
            <DateRangeSpecify
              label="記録期間"
              value={timeRecordDate}
              onChange={onTimeRecordDateChange}
            />
            <Combobox
              label="記録者"
              value={timeRecordFilterUserIds}
              options={groupedUserOptions}
              onChange={(values: (string | number)[]) => {
                onTimeRecordFilterUserIdsChange(
                  values.filter((v) => String(v) !== UNGROUPED_OPTION_VALUE),
                );
              }}
              placeholder="全員"
              isMulti={true}
              size="small"
              className="w-[16.5rem]"
            />
          </FilterRow>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{projectCount} プロジェクト</span>
          {showTicketFilters && issueCount != null && (
            <>
              <span className="text-gray-300">·</span>
              <span>{issueCount} チケット</span>
            </>
          )}
          {showTimeRecordFilters && entryCount != null && (
            <>
              <span className="text-gray-300">·</span>
              <span>{entryCount} 記録</span>
            </>
          )}
        </div>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <X size={14} />
            条件をすべてクリア
          </button>
        )}
      </div>
    </div>
  );
}
