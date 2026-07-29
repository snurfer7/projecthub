import { formatDateToYYYYMMDD } from './format';

/** 日付範囲の指定方法 */
export type DateRangeSpecifyMode = 'relative' | 'direct';

/** 相対指定のプリセット */
export type DateRangeRelativePreset =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'last7Days'
  | 'last30Days'
  | 'next7Days'
  | 'thisWeek'
  | 'nextWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'nextMonth'
  | 'lastMonth'
  | 'thisFiscalYear'
  | 'lastFiscalYear';

export type DateRangeRelativeOption =
  | { type: 'group'; label: string }
  | { type: 'option'; value: DateRangeRelativePreset; label: string };

export const DATE_RANGE_RELATIVE_OPTIONS: DateRangeRelativeOption[] = [
  { type: 'group', label: '今日周辺' },
  { type: 'option', value: 'today', label: '今日' },
  { type: 'option', value: 'tomorrow', label: '明日' },
  { type: 'option', value: 'yesterday', label: '昨日' },
  { type: 'group', label: '直近・将来' },
  { type: 'option', value: 'last7Days', label: '直近7日間（今日含む）' },
  { type: 'option', value: 'last30Days', label: '直近30日間（今日含む）' },
  { type: 'option', value: 'next7Days', label: '今後7日間' },
  { type: 'group', label: '週単位' },
  { type: 'option', value: 'thisWeek', label: '今週（月〜日）' },
  { type: 'option', value: 'nextWeek', label: '来週' },
  { type: 'option', value: 'lastWeek', label: '先週' },
  { type: 'group', label: '月単位' },
  { type: 'option', value: 'thisMonth', label: '今月（1日〜末日）' },
  { type: 'option', value: 'nextMonth', label: '来月' },
  { type: 'option', value: 'lastMonth', label: '先月' },
  { type: 'group', label: '年度単位' },
  { type: 'option', value: 'thisFiscalYear', label: '今年度（6月〜翌3月）' },
  { type: 'option', value: 'lastFiscalYear', label: '前年度' },
];

const PRESET_SET = new Set<string>(
  DATE_RANGE_RELATIVE_OPTIONS.filter(
    (o): o is Extract<DateRangeRelativeOption, { type: 'option' }> => o.type === 'option',
  ).map((o) => o.value),
);

export function isDateRangeSpecifyMode(v: unknown): v is DateRangeSpecifyMode {
  return v === 'relative' || v === 'direct';
}

export function isDateRangeRelativePreset(v: unknown): v is DateRangeRelativePreset {
  return typeof v === 'string' && PRESET_SET.has(v);
}

export function dateRangeRelativeLabel(preset: DateRangeRelativePreset | ''): string {
  if (!preset) return '';
  const found = DATE_RANGE_RELATIVE_OPTIONS.find(
    (o) => o.type === 'option' && o.value === preset,
  );
  return found && found.type === 'option' ? found.label : preset;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeekSunday(weekStartMonday: Date): Date {
  return addDays(weekStartMonday, 6);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 年度開始年（6月始まり）。1〜5月は前年が開始年。 */
function fiscalYearStartYear(date: Date): number {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
}

function fiscalYearRange(startYear: number): { start: string; end: string } {
  return {
    start: formatDateToYYYYMMDD(new Date(startYear, 5, 1)), // 6/1
    end: formatDateToYYYYMMDD(new Date(startYear + 1, 2, 31)), // 翌3/31
  };
}

/** 相対プリセットから YYYY-MM-DD の開始・終了を算出する */
export function resolveRelativeDateRange(
  preset: DateRangeRelativePreset,
  now: Date = new Date(),
): { start: string; end: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = formatDateToYYYYMMDD(today);

  switch (preset) {
    case 'today':
      return { start: todayStr, end: todayStr };
    case 'tomorrow': {
      const d = addDays(today, 1);
      const s = formatDateToYYYYMMDD(d);
      return { start: s, end: s };
    }
    case 'yesterday': {
      const d = addDays(today, -1);
      const s = formatDateToYYYYMMDD(d);
      return { start: s, end: s };
    }
    case 'last7Days':
      return { start: formatDateToYYYYMMDD(addDays(today, -6)), end: todayStr };
    case 'last30Days':
      return { start: formatDateToYYYYMMDD(addDays(today, -29)), end: todayStr };
    case 'next7Days':
      // 今日を含む今後7日間
      return { start: todayStr, end: formatDateToYYYYMMDD(addDays(today, 6)) };
    case 'thisWeek': {
      const start = startOfWeekMonday(today);
      return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(endOfWeekSunday(start)) };
    }
    case 'nextWeek': {
      const start = addDays(startOfWeekMonday(today), 7);
      return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(endOfWeekSunday(start)) };
    }
    case 'lastWeek': {
      const start = addDays(startOfWeekMonday(today), -7);
      return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(endOfWeekSunday(start)) };
    }
    case 'thisMonth': {
      const y = today.getFullYear();
      const m = today.getMonth();
      return {
        start: formatDateToYYYYMMDD(new Date(y, m, 1)),
        end: formatDateToYYYYMMDD(new Date(y, m, daysInMonth(y, m))),
      };
    }
    case 'nextMonth': {
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const year = m > 11 ? y + 1 : y;
      const month = m % 12;
      return {
        start: formatDateToYYYYMMDD(new Date(year, month, 1)),
        end: formatDateToYYYYMMDD(new Date(year, month, daysInMonth(year, month))),
      };
    }
    case 'lastMonth': {
      const y = today.getFullYear();
      const m = today.getMonth() - 1;
      const year = m < 0 ? y - 1 : y;
      const month = m < 0 ? 11 : m;
      return {
        start: formatDateToYYYYMMDD(new Date(year, month, 1)),
        end: formatDateToYYYYMMDD(new Date(year, month, daysInMonth(year, month))),
      };
    }
    case 'thisFiscalYear':
      return fiscalYearRange(fiscalYearStartYear(today));
    case 'lastFiscalYear':
      return fiscalYearRange(fiscalYearStartYear(today) - 1);
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

/** mode に応じて実際に使う開始・終了を返す（相対は都度再計算） */
export function effectiveDateRange(
  mode: DateRangeSpecifyMode | undefined,
  relative: DateRangeRelativePreset | '' | undefined,
  start: string,
  end: string,
  now: Date = new Date(),
): { start: string; end: string } {
  if (mode === 'relative' && relative && isDateRangeRelativePreset(relative)) {
    return resolveRelativeDateRange(relative, now);
  }
  return { start, end };
}

/**
 * 保存済み検索用に日付範囲をシリアライズする。
 * 相対指定: mode / relative のみ（日付は含めない）
 * 直接指定: mode と start / end
 */
export function toSavedDateRangeFields(
  mode: DateRangeSpecifyMode,
  relative: DateRangeRelativePreset | '',
  start: string,
  end: string,
): {
  mode: DateRangeSpecifyMode;
  relative: DateRangeRelativePreset | '';
  start?: string;
  end?: string;
} {
  if (mode === 'relative') {
    return {
      mode: 'relative',
      relative: isDateRangeRelativePreset(relative) ? relative : 'today',
    };
  }
  return {
    mode: 'direct',
    relative: '',
    start,
    end,
  };
}
