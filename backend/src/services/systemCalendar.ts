import { PrismaClient } from '@prisma/client';

export type HolidayDateEntry = { date: string; name: string };

export type WorkCalendarSettings = {
  startTime: string;
  endTime: string;
  managementTimes: string[];
  conversionTimes: number[];
  holidayWeekdays: number[];
  holidays: HolidayDateEntry[];
  workdays: HolidayDateEntry[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHolidayDateEntries(raw: unknown, fieldLabel: string): HolidayDateEntry[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: `${fieldLabel} は配列である必要があります` };
  }
  const byDate = new Map<string, string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { error: `${fieldLabel} の各要素はオブジェクトである必要があります` };
    }
    const date = typeof (item as { date?: unknown }).date === 'string'
      ? (item as { date: string }).date.trim()
      : '';
    const name = typeof (item as { name?: unknown }).name === 'string'
      ? (item as { name: string }).name.trim()
      : '';
    if (!DATE_RE.test(date)) {
      return { error: `${fieldLabel} の date は YYYY-MM-DD 形式である必要があります` };
    }
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      return { error: `${fieldLabel} に無効な日付があります: ${date}` };
    }
    if (!name) {
      return { error: `${fieldLabel} の name は必須です` };
    }
    byDate.set(date, name);
  }
  return [...byDate.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function parseHolidayWeekdays(raw: unknown): number[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: 'holidayWeekdays は配列である必要があります' };
  }
  const set = new Set<number>();
  for (const v of raw) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 6) {
      return { error: 'holidayWeekdays の各要素は 0〜6 である必要があります' };
    }
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function holidaySettingsDto(row: {
  holidayWeekdays?: number[] | null;
  holidays?: unknown;
  workdays?: unknown;
} | null) {
  const holidaysRaw = row?.holidays;
  const workdaysRaw = row?.workdays;
  const holidays = Array.isArray(holidaysRaw) ? holidaysRaw : [];
  const workdays = Array.isArray(workdaysRaw) ? workdaysRaw : [];
  const parsedHolidays = parseHolidayDateEntries(holidays, 'holidays');
  const parsedWorkdays = parseHolidayDateEntries(workdays, 'workdays');
  return {
    holidayWeekdays: row
      ? [...(row.holidayWeekdays ?? [])].sort((a, b) => a - b)
      : [0, 6],
    holidays: 'error' in parsedHolidays ? [] : parsedHolidays,
    workdays: 'error' in parsedWorkdays ? [] : parsedWorkdays,
  };
}

export async function getOrCreateSystemSetting(prisma: PrismaClient) {
  let setting = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
  if (!setting) {
    setting = await prisma.systemSetting.create({
      data: {
        id: 'default',
        startTime: '09:00',
        endTime: '18:00',
        managementTimes: [],
        conversionTimes: [],
        holidayWeekdays: [0, 6],
        holidays: [],
        workdays: [],
      },
    });
  }
  return setting;
}

export function workCalendarDto(row: Awaited<ReturnType<typeof getOrCreateSystemSetting>>): WorkCalendarSettings {
  const holiday = holidaySettingsDto(row);
  return {
    startTime: row.startTime,
    endTime: row.endTime,
    managementTimes: row.managementTimes ?? [],
    conversionTimes: row.conversionTimes ?? [],
    holidayWeekdays: holiday.holidayWeekdays,
    holidays: holiday.holidays,
    workdays: holiday.workdays,
  };
}
