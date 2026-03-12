import { useState, useEffect, useMemo } from 'react';
import { FoldVertical, UnfoldVertical } from 'lucide-react';
import api from '../api/client';
import { Tracker, IssueStatus } from '../types';
import Combobox from './Combobox';
import CustomDatePicker from './CustomDatePicker';

type ZoomLevel = 'day' | 'month' | 'year';

interface ChartTicketSearchSectionProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  startValue: string;
  onStartValueChange: (value: string) => void;
  endValue: string;
  onEndValueChange: (value: string) => void;
  filterTrackerId: number | '';
  onFilterTrackerIdChange: (value: number | '') => void;
  filterStatusId: number | '';
  onFilterStatusIdChange: (value: number | '') => void;
  filterAssignedToId: number | '';
  onFilterAssignedToIdChange: (value: number | '') => void;
  issueCount: number;
  showProject: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 30, label: '日' },
  month: { dayWidth: 4, label: '月' },
  year: { dayWidth: 1.5, label: '年' },
};

export default function ChartTicketSearchSection({
  zoom,
  onZoomChange,
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
  showProject,
  onCollapseAll,
  onExpandAll,
}: ChartTicketSearchSectionProps) {
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
        start: new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10),
        end: new Date(currentYear, currentMonth + 6, 0).toISOString().slice(0, 10)
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
    if (value === '') {
      // クリア時は開始値の初期値をセット
      const defaults = getDefaultValues();
      onStartValueChange(defaults.start);
    } else {
      onStartValueChange(value);
    }
  };

  const handleEndValueChange = (value: string) => {
    if (value === '') {
      // クリア時は終了値の初期値をセット
      const defaults = getDefaultValues();
      onEndValueChange(defaults.end);
    } else {
      onEndValueChange(value);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-3">
      {/* ズーム */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">ズーム:</span>
        {(['day', 'month', 'year'] as ZoomLevel[]).map((z) => (
          <button key={z} onClick={() => onZoomChange(z)}
            className={`px-2 py-1 rounded text-xs font-medium ${zoom === z ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {ZOOM_CONFIG[z].label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* 折りたたみ操作（プロジェクトモード時のみ） */}
      {showProject && (
        <>
          <div className="flex items-center gap-1">
            <button
              onClick={onCollapseAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              title="すべて折りたたむ"
            >
              <FoldVertical size={13} />
              <span>すべて折りたたむ</span>
            </button>
            <button
              onClick={onExpandAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              title="すべて展開"
            >
              <UnfoldVertical size={13} />
              <span>すべて展開</span>
            </button>
          </div>
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {/* 期間指定 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">期間:</span>
        {zoom === 'year' ? (
          <div className="flex items-center gap-1">
            <CustomDatePicker
              value={startValue}
              onChange={handleStartValueChange}
              size="small"
              showFloatingLabel={false}
              placeholder="開始"
              className="w-24"
              selectMode="year"
            />
            <span className="text-gray-400">〜</span>
            <CustomDatePicker
              value={endValue}
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
              value={startValue}
              onChange={handleStartValueChange}
              size="small"
              showFloatingLabel={false}
              placeholder="開始"
              className="w-32"
              selectMode="month"
            />
            <span className="text-gray-400">〜</span>
            <CustomDatePicker
              value={endValue}
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
              value={startValue}
              onChange={handleStartValueChange}
              size="small"
              showFloatingLabel={false}
              placeholder="開始"
              className="w-32"
            />
            <span className="text-gray-400">〜</span>
            <CustomDatePicker
              value={endValue}
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
        options={trackers.map((t) => ({ value: t.id.toString(), label: t.name }))}
        onChange={(val) => onFilterTrackerIdChange(val ? Number(val) : '')}
        size="small"
        className="w-32"
      />

      <Combobox
        label="ステータス"
        value={filterStatusId}
        options={statuses.map((s) => ({ value: s.id.toString(), label: s.name }))}
        onChange={(val) => onFilterStatusIdChange(val ? Number(val) : '')}
        size="small"
        className="w-32"
      />

      <Combobox
        label="担当者"
        value={filterAssignedToId}
        options={assignees.map((a) => ({ value: a.id.toString(), label: `${a.lastName} ${a.firstName}` }))}
        onChange={(val) => onFilterAssignedToIdChange(val ? Number(val) : '')}
        size="small"
        className="w-40"
      />

      <div className="ml-auto text-xs text-gray-400">{issueCount} 件</div>
    </div>
  );
}
