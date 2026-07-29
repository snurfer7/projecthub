import { useEffect, useMemo } from 'react';
import Combobox, { type ComboboxOption } from './Combobox';
import DateInput from './DateInput';
import {
  DATE_RANGE_RELATIVE_OPTIONS,
  isDateRangeRelativePreset,
  resolveRelativeDateRange,
  type DateRangeRelativePreset,
  type DateRangeSpecifyMode,
} from '../utils/dateRangeSpecify';

export type DateRangeSpecifyValue = {
  mode: DateRangeSpecifyMode;
  relative: DateRangeRelativePreset | '';
  start: string;
  end: string;
};

type Props = {
  label: string;
  value: DateRangeSpecifyValue;
  onChange: (next: DateRangeSpecifyValue) => void;
};

function applyRelative(
  relative: DateRangeRelativePreset,
): Pick<DateRangeSpecifyValue, 'relative' | 'start' | 'end'> {
  const range = resolveRelativeDateRange(relative);
  return { relative, start: range.start, end: range.end };
}

export default function DateRangeSpecify({ label, value, onChange }: Props) {
  const isRelative = value.mode === 'relative';

  const relativeOptions: ComboboxOption[] = useMemo(
    () =>
      DATE_RANGE_RELATIVE_OPTIONS.map((o, index) =>
        o.type === 'group'
          ? {
              value: `__group__:${index}:${o.label}`,
              label: o.label,
              isGroupLabel: true,
            }
          : {
              value: o.value,
              label: o.label,
            },
      ),
    [],
  );

  // 相対指定は都度日付を再計算して表示を同期する
  useEffect(() => {
    if (value.mode !== 'relative' || !value.relative) return;
    const range = resolveRelativeDateRange(value.relative);
    if (range.start === value.start && range.end === value.end) return;
    onChange({ ...value, start: range.start, end: range.end });
    // onChange は親のインライン関数になり得るため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync relative dates only
  }, [value.mode, value.relative, value.start, value.end]);

  const setMode = (mode: DateRangeSpecifyMode) => {
    if (mode === 'relative') {
      const relative = value.relative || 'today';
      onChange({ mode: 'relative', ...applyRelative(relative) });
      return;
    }
    onChange({ ...value, mode: 'direct', relative: '' });
  };

  const setRelative = (relative: DateRangeRelativePreset) => {
    onChange({ mode: 'relative', ...applyRelative(relative) });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shrink-0">
        <button
          type="button"
          onClick={() => setMode('relative')}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            isRelative ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          相対指定
        </button>
        <button
          type="button"
          onClick={() => setMode('direct')}
          className={`px-2 py-1 text-xs font-medium border-l border-gray-300 transition-colors ${
            !isRelative ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          直接指定
        </button>
      </div>
      {isRelative && (
        <Combobox
          label="相対期間"
          options={relativeOptions}
          value={value.relative || 'today'}
          onChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v;
            if (isDateRangeRelativePreset(next)) {
              setRelative(next);
            } else {
              setRelative('today');
            }
          }}
          placeholder="選択"
          isMulti={false}
          isSearchable={false}
          size="small"
          showFloatingLabel={false}
          className="w-[15rem]"
        />
      )}
      <DateInput
        value={value.start}
        onChange={(start) => onChange({ ...value, mode: 'direct', relative: '', start })}
        size="small"
        showFloatingLabel={false}
        placeholder="開始"
        disabled={isRelative}
        className="w-[10.5rem]"
      />
      <span className="text-gray-400 text-xs">〜</span>
      <DateInput
        value={value.end}
        onChange={(end) => onChange({ ...value, mode: 'direct', relative: '', end })}
        size="small"
        showFloatingLabel={false}
        placeholder="終了"
        disabled={isRelative}
        className="w-[10.5rem]"
      />
    </div>
  );
}
