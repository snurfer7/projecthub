import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import api from '../api/client';
import { Company, IssueStatus, Tracker, SavedSearch } from '../types';
import type { ProjectFilterCriteria } from '../utils/projectFilter';
import type { IssueFilterCriteria } from '../utils/issueFilter';
import type { ProjectListViewMode } from '../utils/projectListStorage';
import Combobox from './Combobox';
import TextInput from './TextInput';
import DateInput from './DateInput';
import CustomDatePicker from './CustomDatePicker';
import SavedSearchDropdown from './SavedSearchDropdown';
import { formatDateToYYYYMMDD } from '../utils/format';

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
  timeRecordStartDate: string;
  onTimeRecordStartDateChange: (value: string) => void;
  timeRecordEndDate: string;
  onTimeRecordEndDateChange: (value: string) => void;
  timeRecordFilterUserIds: (number | string)[];
  onTimeRecordFilterUserIdsChange: (values: (number | string)[]) => void;
  onResetAll: () => void;
  projectCount: number;
  issueCount?: number;
  entryCount?: number;
  onNewProjectClick: () => void;
  /** 保存済み検索: 現在アクティブな ID */
  activeSavedSearchId: number | null;
  /** 保存済み検索をロードしたときのコールバック */
  onLoadSavedSearch: (search: SavedSearch) => void;
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
  timeRecordStartDate,
  onTimeRecordStartDateChange,
  timeRecordEndDate,
  onTimeRecordEndDateChange,
  timeRecordFilterUserIds,
  onTimeRecordFilterUserIdsChange,
  onResetAll,
  projectCount,
  issueCount,
  entryCount,
  onNewProjectClick,
  activeSavedSearchId,
  onLoadSavedSearch,
}: ProjectListFilterPanelProps) {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [users, setUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string; members: { userId: number }[] }[]>([]);

  useEffect(() => {
    if (viewMode === 'list') return;
    api.get('/issues/meta/options').then((res) => {
      setTrackers(res.data.trackers);
      setStatuses(res.data.statuses);
      setUsers(res.data.users);
      setGroups(res.data.groups ?? []);
    });
  }, [viewMode]);

  const showTicketFilters = viewMode !== 'list';
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
    projectFilter.companyIds.length > 0 ||
    projectFilter.statuses.length > 0 ||
    issueFilter.trackerIds.length > 0 ||
    issueFilter.statusIds.length > 0 ||
    issueFilter.assignedToIds.length > 0 ||
    issueFilter.assignedToGroupIds.length > 0 ||
    issueFilter.dueDateStart !== '' ||
    issueFilter.dueDateEnd !== '' ||
    ganttStartValue !== '' ||
    ganttEndValue !== '' ||
    timeRecordStartDate !== '' ||
    timeRecordEndDate !== '' ||
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

  const currentFilter: SavedSearch['filter'] = {
    projectFilter: {
      searchQuery: projectFilter.searchQuery,
      companyIds: projectFilter.companyIds,
      statuses: projectFilter.statuses,
    },
    issueFilter: {
      trackerIds: issueFilter.trackerIds,
      statusIds: issueFilter.statusIds,
      assignedToIds: issueFilter.assignedToIds,
      assignedToGroupIds: issueFilter.assignedToGroupIds,
      assignedToGroupMemberIds: issueFilter.assignedToGroupMemberIds,
    },
    ganttZoom,
    timeRecordFilterUserIds,
  };

  return (
    <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
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
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 shrink-0">期限日</span>
            <DateInput
              value={projectFilter.dueDateStart}
              onChange={(value) => onProjectFilterChange({ dueDateStart: value })}
              size="small"
              showFloatingLabel={false}
              placeholder="開始"
              className="w-[10.5rem]"
            />
            <span className="text-gray-400 text-xs">〜</span>
            <DateInput
              value={projectFilter.dueDateEnd}
              onChange={(value) => onProjectFilterChange({ dueDateEnd: value })}
              size="small"
              showFloatingLabel={false}
              placeholder="終了"
              className="w-[10.5rem]"
            />
          </div>
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
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={projectFilter.companyIds}
            onChange={(values) => onProjectFilterChange({ companyIds: values })}
            placeholder="全企業"
            className="w-[21rem]"
            isMulti={true}
            size="small"
          />
        </FilterRow>

        {showTicketFilters && (
          <FilterRow label="チケット">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 shrink-0">期限</span>
              <DateInput
                value={issueFilter.dueDateStart}
                onChange={(value) => onIssueFilterChange({ dueDateStart: value })}
                size="small"
                showFloatingLabel={false}
                placeholder="開始"
                className="w-[10.5rem]"
              />
              <span className="text-gray-400 text-xs">〜</span>
              <DateInput
                value={issueFilter.dueDateEnd}
                onChange={(value) => onIssueFilterChange({ dueDateEnd: value })}
                size="small"
                showFloatingLabel={false}
                placeholder="終了"
                className="w-[10.5rem]"
              />
            </div>
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
                ...issueFilter.assignedToIds.map((id) => String(id)),
                ...issueFilter.assignedToGroupIds.map((id) => `g:${id}`),
              ]}
              options={[
                ...users.map((u) => ({ value: u.id.toString(), label: `${u.lastName} ${u.firstName}` })),
                ...groups.map((g) => ({ value: `g:${g.id}`, label: `[グループ] ${g.name}` })),
              ]}
              onChange={(values: (string | number)[]) => {
                const groupIds = values.filter((v) => String(v).startsWith('g:')).map((v) => String(v).slice(2));
                const userIds = values.filter((v) => !String(v).startsWith('g:'));
                const memberIds: string[] = Array.from(
                  new Set(
                    groupIds.flatMap((gid: string) => {
                      const g = groups.find((grp) => String(grp.id) === String(gid));
                      return g ? g.members.map((m) => String(m.userId)) : [];
                    }),
                  ),
                );
                onIssueFilterChange({ assignedToIds: userIds, assignedToGroupIds: groupIds, assignedToGroupMemberIds: memberIds });
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
          </FilterRow>
        )}

        {showTimeRecordFilters && (
          <FilterRow label="時間記録">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 shrink-0">記録期間</span>
              <DateInput
                value={timeRecordStartDate}
                onChange={onTimeRecordStartDateChange}
                size="small"
                showFloatingLabel={false}
                placeholder="開始"
                className="w-[10.5rem]"
              />
              <span className="text-gray-400 text-xs">〜</span>
              <DateInput
                value={timeRecordEndDate}
                onChange={onTimeRecordEndDateChange}
                size="small"
                showFloatingLabel={false}
                placeholder="終了"
                className="w-[10.5rem]"
              />
            </div>
            <Combobox
              label="記録者"
              value={timeRecordFilterUserIds}
              options={users.map((u) => ({ value: u.id.toString(), label: `${u.lastName} ${u.firstName}` }))}
              onChange={onTimeRecordFilterUserIdsChange}
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
