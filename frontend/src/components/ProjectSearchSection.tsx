import { X } from 'lucide-react';
import { Company } from '../types';
import type { ProjectFilterCriteria } from '../utils/projectFilter';
import Combobox from './Combobox';
import TextInput from './TextInput';
import DateInput from './DateInput';

interface ProjectSearchSectionProps {
  filter: ProjectFilterCriteria;
  onFilterChange: (patch: Partial<ProjectFilterCriteria>) => void;
  onResetFilter?: () => void;
  companies: Company[];
  totalCount: number;
  onNewProjectClick: () => void;
}

export default function ProjectSearchSection({
  filter,
  onFilterChange,
  onResetFilter,
  companies,
  totalCount,
  onNewProjectClick,
}: ProjectSearchSectionProps) {
  const hasActiveFilter =
    filter.searchQuery.trim() !== '' ||
    filter.dueDateStart !== '' ||
    filter.dueDateEnd !== '' ||
    filter.companyIds.length > 0;

  return (
    <div className="flex gap-3 mb-4 items-center">
      <div className="bg-white rounded-lg shadow p-3 flex-1 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-500">検索:</span>
        <TextInput
          placeholder="プロジェクト名、識別子、説明、企業名..."
          value={filter.searchQuery}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          size="small"
          showFloatingLabel={false}
          className="w-64"
        />
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">期限日:</span>
          <div className="flex items-center gap-1">
            <DateInput
              value={filter.dueDateStart}
              onChange={(value) => onFilterChange({ dueDateStart: value })}
              size="small"
              showFloatingLabel={false}
              placeholder="開始"
              className="w-32"
            />
            <span className="text-gray-400 text-xs">〜</span>
            <DateInput
              value={filter.dueDateEnd}
              onChange={(value) => onFilterChange({ dueDateEnd: value })}
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
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={filter.companyIds}
            onChange={(values) => onFilterChange({ companyIds: values })}
            placeholder="全企業"
            className="w-64"
            isMulti={true}
            size="small"
          />
        </div>
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
        <div className="ml-auto text-xs text-gray-400">{totalCount} プロジェクト</div>
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
