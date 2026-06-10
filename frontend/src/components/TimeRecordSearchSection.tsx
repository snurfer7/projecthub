import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';
import Combobox from './Combobox';
import DateInput from './DateInput';

interface TimeRecordSearchSectionProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  filterUserIds: (number | string)[];
  onFilterUserIdsChange: (values: (number | string)[]) => void;
  onResetFilter?: () => void;
  entryCount: number;
}

export default function TimeRecordSearchSection({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  filterUserIds,
  onFilterUserIdsChange,
  onResetFilter,
  entryCount,
}: TimeRecordSearchSectionProps) {
  const [users, setUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => setUsers(res.data.users));
  }, []);

  const hasActiveFilter =
    startDate !== '' || endDate !== '' || filterUserIds.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">記録期間:</span>
        <div className="flex items-center gap-1">
          <DateInput
            value={startDate}
            onChange={onStartDateChange}
            size="small"
            showFloatingLabel={false}
            placeholder="開始"
            className="w-48"
          />
          <span className="text-gray-400 text-xs">〜</span>
          <DateInput
            value={endDate}
            onChange={onEndDateChange}
            size="small"
            showFloatingLabel={false}
            placeholder="終了"
            className="w-48"
          />
        </div>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      <Combobox
        label="担当者"
        value={filterUserIds}
        options={users.map((u) => ({ value: u.id.toString(), label: `${u.lastName} ${u.firstName}` }))}
        onChange={onFilterUserIdsChange}
        placeholder="全担当者"
        isMulti={true}
        size="small"
        className="w-72"
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

      <div className="ml-auto text-xs text-gray-400">{entryCount} 件</div>
    </div>
  );
}
