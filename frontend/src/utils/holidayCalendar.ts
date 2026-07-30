import { HolidayDateEntry, WorkCalendarSettings } from '../types';
import { formatDateToYYYYMMDD } from './format';

export type HolidayCalendarInput = {
  holidayWeekdays?: number[];
  holidays?: HolidayDateEntry[];
  workdays?: HolidayDateEntry[];
};

/**
 * 非営業日判定。優先度: 個別出勤 > 個別休日 > 曜日休日。
 * settings 未指定時は土日を休日とする（従来のガント表示と同等）。
 */
export function isNonWorkingDay(date: Date, settings?: HolidayCalendarInput | null): boolean {
  const ymd = formatDateToYYYYMMDD(date);
  if (settings) {
    if ((settings.workdays ?? []).some((w) => w.date === ymd)) return false;
    if ((settings.holidays ?? []).some((h) => h.date === ymd)) return true;
    const weekdays = settings.holidayWeekdays;
    if (weekdays !== undefined) {
      return weekdays.includes(date.getDay());
    }
  }
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** date をその日のまま次の営業日まで進める（時刻は維持） */
export function advanceToWorkingDay(date: Date, settings?: HolidayCalendarInput | null): Date {
  const d = new Date(date);
  let safety = 0;
  while (isNonWorkingDay(d, settings) && safety++ < 4000) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** カレンダー日を `count` 営業日だけ進める（休日を飛ばす） */
export function addWorkingDays(date: Date, count: number, settings?: HolidayCalendarInput | null): Date {
  if (count <= 0) return new Date(date);
  const d = new Date(date);
  let added = 0;
  let safety = 0;
  while (added < count && safety++ < 10000) {
    d.setDate(d.getDate() + 1);
    if (!isNonWorkingDay(d, settings)) added++;
  }
  return d;
}

export function toWorkCalendarPartial(settings?: WorkCalendarSettings | null): HolidayCalendarInput | undefined {
  if (!settings) return undefined;
  return {
    holidayWeekdays: settings.holidayWeekdays,
    holidays: settings.holidays,
    workdays: settings.workdays,
  };
}
