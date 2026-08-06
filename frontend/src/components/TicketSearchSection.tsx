import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';
import { Tracker, IssueStatus } from '../types';
import Combobox from './Combobox';
import CustomDatePicker from './CustomDatePicker';
import DateInput from './DateInput';
import { formatDateToYYYYMMDD } from '../utils/format';
import {
  buildGroupedUserOptions,
  splitGroupedAssigneeSelection,
  type GroupedUserOptionGroup,
} from '../utils/groupedUserOptions';

type ZoomLevel = 'day' | 'month' | 'year';

interface TicketSearchSectionProps {
  zoom?: ZoomLevel;
  startValue?: string;
  onStartValueChange?: (value: string) => void;
  endValue?: string;
  onEndValueChange?: (value: string) => void;
  filterTrackerIds: (number | string)[];
  onFilterTrackerIdsChange: (values: (number | string)[]) => void;
  filterStatusIds: (number | string)[];
  onFilterStatusIdsChange: (values: (number | string)[]) => void;
  filterAssignedToIds: (number | string)[];
  onFilterAssignedToIdsChange: (values: (number | string)[]) => void;
  filterAssignedToGroupIds?: (number | string)[];
  filterAssignedToGroupMemberIds?: (number | string)[];
  onFilterAssignedToGroupIdsChange?: (values: (number | string)[]) => void;
  onFilterAssignedToGroupMemberIdsChange?: (values: (number | string)[]) => void;
  dueDateStart?: string;
  onDueDateStartChange?: (value: string) => void;
  dueDateEnd?: string;
  onDueDateEndChange?: (value: string) => void;
  scheduleDateStart?: string;
  onScheduleDateStartChange?: (value: string) => void;
  scheduleDateEnd?: string;
  onScheduleDateEndChange?: (value: string) => void;
  includeUnscheduled?: boolean;
  onIncludeUnscheduledChange?: (value: boolean) => void;
  onResetFilter?: () => void;
  issueCount: number;
}

export default function TicketSearchSection({
  zoom,
  startValue,
  onStartValueChange,
  endValue,
  onEndValueChange,
  filterTrackerIds,
  onFilterTrackerIdsChange,
  filterStatusIds,
  onFilterStatusIdsChange,
  filterAssignedToIds,
  onFilterAssignedToIdsChange,
  filterAssignedToGroupIds = [],
  onFilterAssignedToGroupIdsChange,
  onFilterAssignedToGroupMemberIdsChange,
  dueDateStart,
  onDueDateStartChange,
  dueDateEnd,
  onDueDateEndChange,
  scheduleDateStart,
  onScheduleDateStartChange,
  scheduleDateEnd,
  onScheduleDateEndChange,
  includeUnscheduled = false,
  onIncludeUnscheduledChange,
  onResetFilter,
  issueCount,
}: TicketSearchSectionProps) {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [assignees, setAssignees] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [groups, setGroups] = useState<GroupedUserOptionGroup[]>([]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => {
      setTrackers(res.data.trackers);
      setStatuses(res.data.statuses);
      setAssignees(res.data.users);
      setGroups(res.data.groups ?? []);
    });
  }, []);

  const assigneeOptions = useMemo(
    () => buildGroupedUserOptions({ users: assignees, groups }),
    [assignees, groups],
  );

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = [];
    for (let i = currentYear - 5; i <= currentYear + 20; i++) {
      result.push(i);
    }
    return result;
  }, []);

  // ズームレベルに応じた初期値を取得
  const getDefaultValues = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (zoom === 'day') {
      return {
        start: formatDateToYYYYMMDD(new Date(currentYear, currentMonth, 1)),
        end: formatDateToYYYYMMDD(new Date(currentYear, currentMonth + 6, 0))
      };
    } else if (zoom === 'month') {
      const startMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const endMonth = currentMonth + 11;
      const endYear = currentYear + Math.floor(endMonth / 12);
      const endMonthNum = ((endMonth % 12) + 1);
      const endMonthStr = `${endYear}-${String(endMonthNum).padStart(2, '0')}`;
      return {
        start: startMonthStr,
        end: endMonthStr
      };
    } else {
      return {
        start: `${currentYear}`,
        end: `${currentYear + 9}`
      };
    }
  };

  // クリア時のハンドラー
  const handleStartValueChange = (value: string) => {
    if (!onStartValueChange) return;
    if (value === '') {
      // クリア時は現在のズームレベルに応じた初期値をセット
      const defaults = getDefaultValues();
      onStartValueChange(defaults.start);
    } else {
      onStartValueChange(value);
    }
  };

  const handleEndValueChange = (value: string) => {
    if (!onEndValueChange) return;
    if (value === '') {
      const defaults = getDefaultValues();
      onEndValueChange(defaults.end);
    } else {
      onEndValueChange(value);
    }
  };

  const handleAssigneeChange = (values: (string | number)[]) => {
    const { userIds, groupIds } = splitGroupedAssigneeSelection(values, groups);
    if (onFilterAssignedToGroupIdsChange || onFilterAssignedToGroupMemberIdsChange) {
      onFilterAssignedToIdsChange(userIds);
      onFilterAssignedToGroupIdsChange?.(groupIds);
      // グループ選択は担当グループ一致のみ（メンバー展開しない）
      onFilterAssignedToGroupMemberIdsChange?.([]);
    } else {
      // グループ状態を持てない呼び出し側向け: グループ選択は条件に反映できないためユーザーのみ
      onFilterAssignedToIdsChange(userIds);
    }
  };

  const hasActiveFilter =
    filterTrackerIds.length > 0 ||
    filterStatusIds.length > 0 ||
    filterAssignedToIds.length > 0 ||
    filterAssignedToGroupIds.length > 0 ||
    (onDueDateStartChange != null && ((dueDateStart ?? '') !== '' || (dueDateEnd ?? '') !== '')) ||
    (onScheduleDateStartChange != null &&
      ((scheduleDateStart ?? '') !== '' ||
        (scheduleDateEnd ?? '') !== '' ||
        includeUnscheduled)) ||
    (onStartValueChange != null && ((startValue ?? '') !== '' || (endValue ?? '') !== ''));

  const showPeriod = onStartValueChange != null && onEndValueChange != null;
  const showScheduleFilter =
    onScheduleDateStartChange != null && onScheduleDateEndChange != null;

  return (
    <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-3">
      {/* 期間指定（ガント表示範囲など。ハンドラ未指定時は非表示） */}
      {showPeriod && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">期間:</span>
            {zoom === 'year' ? (
              <div className="flex items-center gap-1">
                <CustomDatePicker
                  value={startValue || ''}
                  onChange={handleStartValueChange}
                  size="small"
                  showFloatingLabel={false}
                  placeholder="開始"
                  className="w-36"
                  selectMode="year"
                />
                <span className="text-gray-400">〜</span>
                <CustomDatePicker
                  value={endValue || ''}
                  onChange={handleEndValueChange}
                  size="small"
                  showFloatingLabel={false}
                  placeholder="終了"
                  className="w-36"
                  selectMode="year"
                />
              </div>
            ) : zoom === 'month' ? (
              <div className="flex items-center gap-1">
                <CustomDatePicker
                  value={startValue || ''}
                  onChange={handleStartValueChange}
                  size="small"
                  showFloatingLabel={false}
                  placeholder="開始"
                  className="w-48"
                  selectMode="month"
                />
                <span className="text-gray-400">〜</span>
                <CustomDatePicker
                  value={endValue || ''}
                  onChange={handleEndValueChange}
                  size="small"
                  showFloatingLabel={false}
                  placeholder="終了"
                  className="w-48"
                  selectMode="month"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <CustomDatePicker
                  value={startValue || ''}
                  onChange={handleStartValueChange}
                  size="small"
                  showFloatingLabel={false}
                  placeholder="開始"
                  className="w-48"
                />
                <span className="text-gray-400">〜</span>
                <CustomDatePicker
                  value={endValue || ''}
                  onChange={handleEndValueChange}
                  size="small"
                  showFloatingLabel={false}
                  placeholder="終了"
                  className="w-48"
                />
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {onDueDateStartChange && onDueDateEndChange && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">チケット期限:</span>
            <div className="flex items-center gap-1">
              <DateInput
                value={dueDateStart || ''}
                onChange={onDueDateStartChange}
                size="small"
                showFloatingLabel={false}
                placeholder="開始"
                className="w-48"
              />
              <span className="text-gray-400 text-xs">〜</span>
              <DateInput
                value={dueDateEnd || ''}
                onChange={onDueDateEndChange}
                size="small"
                showFloatingLabel={false}
                placeholder="終了"
                className="w-48"
              />
            </div>
          </div>
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {showScheduleFilter && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">開始・終了:</span>
            <div className="flex items-center gap-1">
              <DateInput
                value={scheduleDateStart || ''}
                onChange={onScheduleDateStartChange}
                size="small"
                showFloatingLabel={false}
                placeholder="開始"
                className="w-48"
              />
              <span className="text-gray-400 text-xs">〜</span>
              <DateInput
                value={scheduleDateEnd || ''}
                onChange={onScheduleDateEndChange}
                size="small"
                showFloatingLabel={false}
                placeholder="終了"
                className="w-48"
              />
            </div>
            {onIncludeUnscheduledChange && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-1">
                <input
                  type="checkbox"
                  checked={includeUnscheduled}
                  onChange={(e) => onIncludeUnscheduledChange(e.target.checked)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                />
                <span className="text-xs text-gray-600">開始・終了未設定を含む</span>
              </label>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {/* フィルター */}
      <Combobox
        label="トラッカー"
        value={filterTrackerIds}
        options={trackers.map((t: Tracker) => ({ value: t.id.toString(), label: t.name }))}
        onChange={onFilterTrackerIdsChange}
        placeholder="全トラッカー"
        isMulti={true}
        size="small"
        className="w-[13.5rem]"
      />

      <Combobox
        label="ステータス"
        value={filterStatusIds}
        options={statuses.map((s: IssueStatus) => ({ value: s.id.toString(), label: s.name }))}
        onChange={onFilterStatusIdsChange}
        placeholder="全ステータス"
        isMulti={true}
        size="small"
        className="w-[13.5rem]"
      />

      <Combobox
        label="担当者"
        value={[
          ...filterAssignedToIds.map((id) => String(id)),
          ...filterAssignedToGroupIds.map((id) => `g:${id}`),
        ]}
        options={assigneeOptions}
        onChange={handleAssigneeChange}
        placeholder="全担当者"
        isMulti={true}
        size="small"
        className="w-[16.5rem]"
      />

      {hasActiveFilter && onResetFilter && (
        <button
          type="button"
          onClick={onResetFilter}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <X size={14} />
          条件クリア
        </button>
      )}

      <div className="ml-auto text-xs text-gray-400">{issueCount} チケット</div>
    </div>
  );
}
