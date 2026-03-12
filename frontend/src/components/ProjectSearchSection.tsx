import { Company } from '../types';
import Combobox from './Combobox';
import TextInput from './TextInput';
import DateInput from './DateInput';

interface ProjectSearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  startMonth: string;
  onStartMonthChange: (value: string) => void;
  endMonth: string;
  onEndMonthChange: (value: string) => void;
  companyIds: (number | string)[];
  onCompanyIdsChange: (values: (number | string)[]) => void;
  companies: Company[];
  totalCount: number;
  onNewProjectClick: () => void;
}

export default function ProjectSearchSection({
  searchQuery,
  onSearchQueryChange,
  startMonth,
  onStartMonthChange,
  endMonth,
  onEndMonthChange,
  companyIds,
  onCompanyIdsChange,
  companies,
  totalCount,
  onNewProjectClick,
}: ProjectSearchSectionProps) {
  return (
    <div className="flex gap-3 mb-4 items-center">
      <div className="bg-white rounded-lg shadow p-3 flex-1 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-500">検索:</span>
        <TextInput
          placeholder="プロジェクト名、識別子、企業名..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          size="small"
          showFloatingLabel={false}
          className="w-64"
        />
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">期間:</span>
          <div className="flex items-center gap-1">
            <DateInput
              value={startMonth}
              onChange={onStartMonthChange}
              size="small"
              showFloatingLabel={false}
              placeholder="開始"
              className="w-32"
            />
            <span className="text-gray-400 text-xs">〜</span>
            <DateInput
              value={endMonth}
              onChange={onEndMonthChange}
              size="small"
              showFloatingLabel={false}
              placeholder="終了"
              className="w-32"
            />
          </div>
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-2">
          <Combobox
            label="企業"
            options={companies.map(c => ({ value: c.id, label: c.name }))}
            value={companyIds}
            onChange={onCompanyIdsChange}
            placeholder="全企業"
            className="w-64"
            isMulti={true}
            size="small"
          />
        </div>
        <div className="ml-auto text-xs text-gray-400">{totalCount} 件</div>
      </div>
      <button
        onClick={onNewProjectClick}
        className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm shadow-sm transition-all whitespace-nowrap"
      >
        新規プロジェクト
      </button>
    </div>
  );
}
