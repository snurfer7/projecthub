import { useEffect, useState } from 'react';
import api from '../api/client';
import Combobox from './Combobox';
import DateInput from './DateInput';

interface TimeRecordSearchSectionProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  filterUserId: number | '';
  onFilterUserIdChange: (value: number | '') => void;
  entryCount: number;
}

export default function TimeRecordSearchSection({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  filterUserId,
  onFilterUserIdChange,
  entryCount,
}: TimeRecordSearchSectionProps) {
  const [users, setUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => setUsers(res.data.users));
  }, []);

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
            className="w-32"
          />
          <span className="text-gray-400 text-xs">〜</span>
          <DateInput
            value={endDate}
            onChange={onEndDateChange}
            size="small"
            showFloatingLabel={false}
            placeholder="終了"
            className="w-32"
          />
        </div>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      <Combobox
        label="担当者"
        value={filterUserId}
        options={users.map((u) => ({ value: u.id.toString(), label: `${u.lastName} ${u.firstName}` }))}
        onChange={(val) => onFilterUserIdChange(val ? Number(val) : '')}
        size="small"
        className="w-40"
      />

      <div className="ml-auto text-xs text-gray-400">{entryCount} 件</div>
    </div>
  );
}
