import { formatDateToYYYYMMDD } from './format';

export function todayDateString(): string {
  return formatDateToYYYYMMDD(new Date());
}

export function timeViewAssignedToIds(userId: number): number[] {
  return [userId];
}

export function timeViewRecordDateRange(): { startDate: string; endDate: string } {
  const today = todayDateString();
  return { startDate: today, endDate: today };
}

export function timeViewTicketDueDateRange(): { dueDateStart: string; dueDateEnd: string } {
  const today = todayDateString();
  return { dueDateStart: today, dueDateEnd: today };
}

export function timeViewRecordUserIds(userId: number): number[] {
  return [userId];
}
