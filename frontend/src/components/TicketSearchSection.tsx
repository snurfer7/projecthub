import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { Tracker, IssueStatus } from '../types';
import Combobox from './Combobox';
import CustomDatePicker from './CustomDatePicker';
import { formatDateToYYYYMMDD } from '../utils/format';

type ZoomLevel = 'day' | 'month' | 'year';

interface TicketSearchSectionProps {
  zoom?: ZoomLevel;
  startValue?: string;
  onStartValueChange?: (value: string) => void;
  endValue?: string;
  onEndValueChange?: (value: string) => void;
  filterTrackerId: number | '';
  onFilterTrackerIdChange: (value: number | '') => void;
  filterStatusId: number | '';
  onFilterStatusIdChange: (value: number | '') => void;
  filterAssignedToId: number | '';
  onFilterAssignedToIdChange: (value: number | '') => void;
  issueCount: number;
}

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 30, label: '日' },
  month: { dayWidth: 4, label: '月' },
  year: { dayWidth: 1.5, label: '年' },
};

export default function TicketSearchSection({
  zoom,
  startValue,
  onStartValueChange,
  endValue,
  onEndValueChange,
  filterTrackerId,
  onFilterTrackerIdChange,
  filterStatusId,
  onFilterStatusIdChange,
  filterAssignedToId,
  onFilterAssignedToIdChange,
  issueCount,
}: TicketSearchSectionProps) {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [assignees, setAssignees] = useState<{ id: number; firstName: string; lastName: string }[]>([]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => {
      setTrackers(res.data.trackers);
      setStatuses(res.data.statuses);
      setAssignees(res.data.users);
    });
  }, []);

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

  return (
    <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-3">
      {/* 期間指定 */}
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
              className="w-24"
              selectMode="year"
            />
            <span className="text-gray-400">〜</span>
            <CustomDatePicker
              value={endValue || ''}
              onChange={handleEndValueChange}
              size="small"
              showFloatingLabel={false}
              placeholder="終了"
              className="w-24"
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
              className="w-32"
              selectMode="month"
            />
            <span className="text-gray-400">〜</span>
            <CustomDatePicker
              value={endValue || ''}
              onChange={handleEndValueChange}
              size="small"
              showFloatingLabel={false}
              placeholder="終了"
              className="w-32"
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
              className="w-32"
            />
            <span className="text-gray-400">〜</span>
            <CustomDatePicker
              value={endValue || ''}
              onChange={handleEndValueChange}
              size="small"
              showFloatingLabel={false}
              placeholder="終了"
              className="w-32"
            />
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* フィルター */}
      <Combobox
        label="トラッカー"
        value={filterTrackerId}
        options={trackers.map((t: Tracker) => ({ value: t.id.toString(), label: t.name }))}
        onChange={(val) => onFilterTrackerIdChange(val ? Number(val) : '')}
        size="small"
        className="w-32"
      />

      <Combobox
        label="ステータス"
        value={filterStatusId}
        options={statuses.map((s: IssueStatus) => ({ value: s.id.toString(), label: s.name }))}
        onChange={(val) => onFilterStatusIdChange(val ? Number(val) : '')}
        size="small"
        className="w-32"
      />

      <Combobox
        label="担当者"
        value={filterAssignedToId}
        options={assignees.map((a: { id: number; firstName: string; lastName: string }) => ({ value: a.id.toString(), label: `${a.lastName} ${a.firstName}` }))}
        onChange={(val) => onFilterAssignedToIdChange(val ? Number(val) : '')}
        size="small"
        className="w-40"
      />

      <div className="ml-auto text-xs text-gray-400">{issueCount} 件</div>
    </div>
  );
}
