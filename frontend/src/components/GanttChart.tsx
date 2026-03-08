import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FoldVertical, UnfoldVertical, GripVertical, MessageSquare } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueComment, Tracker, IssueStatus, IssuePriority, Project, SystemSetting } from '../types';
import Modal from './Modal';
import IssueForm from './IssueForm';
import MarkdownRenderer from './MarkdownRenderer';

interface GanttChartProps {
  issues: Issue[];
  projects?: Project[];
  showProject?: boolean;
  onUpdateIssue: (id: number, data: { startDate?: string; endDate?: string; dueDate?: string }) => Promise<void>;
  onIssueCreated?: () => void;
  onRelationCreated?: (fromId: number, toId: number) => Promise<void>;
  systemSettings?: SystemSetting;
}

type ZoomLevel = 'day' | 'month' | 'year';

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 30, label: '日' },
  month: { dayWidth: 4, label: '月' },
  year: { dayWidth: 1.5, label: '年' },
};

const TRACKER_COLORS: string[] = [
  '#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6',
];

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getDayOfWeekName(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addHalfDays(date: Date, halfDays: number): Date {
  const d = new Date(date);
  d.setTime(d.getTime() + halfDays * 12 * 60 * 60 * 1000);
  return d;
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

// 換算時間（estimatedHours）から実際の終了日時を逆算する
// conversions[i] = セグメントi全体の換算時間（時間）
function addConvertedHours(startDate: Date, convertedHours: number, settings?: SystemSetting): Date {
  if (!settings || !settings.conversionTimes?.length || !settings.startTime || !settings.endTime || convertedHours <= 0) {
    return addHours(startDate, convertedHours);
  }

  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const workStart = toMinutes(settings.startTime);
  const workEnd = toMinutes(settings.endTime);
  const managementMins = (settings.managementTimes || []).map(toMinutes).sort((a: number, b: number) => a - b);
  const boundaries = [workStart, ...managementMins, workEnd];
  const conversions = settings.conversionTimes;
  const totalDayConversion = conversions.reduce((a, b) => a + b, 0);

  let remaining = convertedHours;
  const current = new Date(startDate);

  // 作業時間外なら開始時刻にクランプ
  const initMin = current.getHours() * 60 + current.getMinutes();
  if (initMin < workStart) {
    current.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
  } else if (initMin >= workEnd) {
    current.setDate(current.getDate() + 1);
    current.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
  }

  // 1日の合計換算時間を超える場合、日数を加算
  if (totalDayConversion > 0 && remaining > totalDayConversion) {
    const daysToAdd = Math.floor((remaining - 1e-4) / totalDayConversion);
    current.setDate(current.getDate() + daysToAdd);
    remaining -= daysToAdd * totalDayConversion;
  }

  let safety = 0;
  while (remaining > 1e-9 && safety++ < 1000) {
    const nowMin = current.getHours() * 60 + current.getMinutes();

    if (nowMin >= workEnd) {
      current.setDate(current.getDate() + 1);
      current.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
      continue;
    }

    let advanced = false;
    for (let i = 0; i < boundaries.length - 1; i++) {
      const segFrom = boundaries[i];
      const segTo = boundaries[i + 1];
      const segDuration = segTo - segFrom; // セグメント全体の実時間（分）
      if (segDuration <= 0) continue;
      if (nowMin < segFrom || nowMin >= segTo) continue;

      const conv = conversions[i] || 0;
      const segRealMin = segTo - nowMin; // このセグメントの残り実時間（分）

      if (conv <= 0) {
        // 換算なしのセグメント（休憩など）はスキップ
        current.setHours(Math.floor(segTo / 60), segTo % 60, 0, 0);
        advanced = true;
        break;
      }

      // このセグメントの残り部分が持つ換算時間
      // conv = セグメント全体の換算時間、segRealMin/segDuration = 残り割合
      const segConvertedHours = conv * segRealMin / segDuration;

      if (remaining <= segConvertedHours + 1e-9) {
        // このセグメント内で終わる
        // remaining = conv * realMin / segDuration → realMin = remaining * segDuration / conv
        const realMin = remaining * segDuration / conv;
        const endMinOfDay = nowMin + realMin;
        current.setHours(Math.floor(endMinOfDay / 60), Math.round(endMinOfDay % 60), 0, 0);
        remaining = 0;
        advanced = true;
        break;
      } else {
        remaining -= segConvertedHours;
        current.setHours(Math.floor(segTo / 60), segTo % 60, 0, 0);
        advanced = true;
        break;
      }
    }

    if (!advanced) {
      current.setDate(current.getDate() + 1);
      current.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
    }
  }

  return current;
}

// バー左端: チケット開始日時を有効なスナップポイント（開始時刻+管理時刻、終了時刻を除く）に切り捨て
function snapToStartPoint(date: Date, settings?: SystemSetting): Date {
  if (!settings || !settings.startTime || !settings.endTime) return date;

  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const workStart = toMinutes(settings.startTime);
  const workEnd = toMinutes(settings.endTime);
  const managementMins = (settings.managementTimes || []).map(toMinutes);
  // 有効な開始スナップ点: [開始時刻, ...管理時刻] (終了時刻を除く)
  const snapPoints = [workStart, ...managementMins].filter(v => v < workEnd).sort((a, b) => a - b);

  const dateMin = date.getHours() * 60 + date.getMinutes();
  const result = new Date(date);
  result.setSeconds(0, 0);

  if (dateMin < workStart) {
    // 開始時刻より前 → 開始時刻へ
    result.setHours(Math.floor(workStart / 60), workStart % 60);
  } else {
    // 最大の snap ≤ dateMin を探す
    let snapMin = workStart;
    for (const snap of snapPoints) {
      if (snap <= dateMin) snapMin = snap;
      else break;
    }
    result.setHours(Math.floor(snapMin / 60), snapMin % 60);
  }
  return result;
}

// バー右端: 算出した終了日時を有効なスナップポイント（管理時刻+終了時刻、開始時刻を除く）に切り上げ
function snapToEndPoint(date: Date, settings?: SystemSetting): Date {
  if (!settings || !settings.startTime || !settings.endTime) return date;

  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const workStart = toMinutes(settings.startTime);
  const workEnd = toMinutes(settings.endTime);
  const managementMins = (settings.managementTimes || []).map(toMinutes);
  // 有効な終了スナップ点: [...管理時刻, 終了時刻] (開始時刻を除く)
  const snapPoints = [...managementMins, workEnd].filter(v => v > workStart).sort((a, b) => a - b);

  const dateMin = date.getHours() * 60 + date.getMinutes();
  const result = new Date(date);
  result.setSeconds(0, 0);

  // 秒やミリ秒がある場合に微調整（管理時刻と完全一致していても、浮動小数点の誤差などで次へ飛ばないように）
  const epsilon = 1e-4;
  const isExactSnap = snapPoints.some(snap => Math.abs(snap - (dateMin + date.getSeconds() / 60)) < epsilon);

  if (dateMin >= workEnd && !isExactSnap) {
    // 終了時刻以降 → 翌日の最初のスナップ点へ（ただし基本は当日内に収まるはず）
    result.setDate(result.getDate() + 1);
    const firstSnap = snapPoints[0];
    result.setHours(Math.floor(firstSnap / 60), firstSnap % 60, 0, 0);
  } else if (isExactSnap) {
    // ぴったりの場合はそのまま
    result.setSeconds(0, 0);
  } else {
    // 最小の snap > dateMin を探す (一致しない場合、一つ後の時刻に合わせる)
    let snapMin = snapPoints[snapPoints.length - 1];
    for (const snap of snapPoints) {
      if (snap > dateMin + epsilon) {
        snapMin = snap;
        break;
      }
    }
    result.setHours(Math.floor(snapMin / 60), snapMin % 60, 0, 0);
  }
  return result;
}

function calcConversionHours(startDate: Date, endDate: Date, settings?: SystemSetting): number {
  if (!settings || !settings.conversionTimes?.length || !settings.startTime || !settings.endTime) {
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2);
  }

  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const startMin = toMinutes(settings.startTime);
  const endMin = toMinutes(settings.endTime);
  const managementMins = (settings.managementTimes || []).map(toMinutes).sort((a, b) => a - b);
  const boundaries = [startMin, ...managementMins, endMin];
  const conversions = settings.conversionTimes;

  let totalHours = 0;
  const startDay = new Date(startDate); startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(endDate); endDay.setHours(0, 0, 0, 0);
  const cur = new Date(startDay);

  while (cur <= endDay) {
    const isFirst = cur.getTime() === startDay.getTime();
    const isLast = cur.getTime() === endDay.getTime();
    const dayStart = isFirst ? startDate.getHours() * 60 + startDate.getMinutes() : startMin;
    const dayEnd = isLast ? endDate.getHours() * 60 + endDate.getMinutes() : endMin;

    for (let i = 0; i < boundaries.length - 1; i++) {
      const segFrom = boundaries[i];
      const segTo = boundaries[i + 1];
      const segDuration = segTo - segFrom;
      if (segDuration <= 0) continue;
      const overlapFrom = Math.max(dayStart, segFrom);
      const overlapTo = Math.min(dayEnd, segTo);
      if (overlapFrom < overlapTo) {
        totalHours += (conversions[i] || 0) * (overlapTo - overlapFrom) / segDuration;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  return Math.max(0, Math.round(totalHours));
}

export default function GanttChart({ issues, projects = [], showProject, onUpdateIssue, onIssueCreated, onRelationCreated, systemSettings }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [startValue, setStartValue] = useState<string>('');
  const [endValue, setEndValue] = useState<string>('');
  const [customLeftColWidth, setCustomLeftColWidth] = useState<number | null>(null);

  const [filterTrackerId, setFilterTrackerId] = useState<number | ''>('');
  const [filterAssignedToId, setFilterAssignedToId] = useState<number | ''>('');
  const [filterStatusId, setFilterStatusId] = useState<number | ''>('');
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [assignees, setAssignees] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [tooltip, setTooltip] = useState<{ issue?: Issue; projectDueDate?: string | null; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{
    issueId: number;
    type: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origStartDate: Date;
    origDueDate: Date;
    origEstimatedHours: number;
    currentStartDate: Date;
    currentDueDate: Date;
  } | null>(null);
  const [relationDrag, setRelationDrag] = useState<{
    fromIssue: Issue;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    toIssueId: number | null;
  } | null>(null);
  const [sortDrag, setSortDrag] = useState<{
    issue: Issue;
    startY: number;
    currentY: number;
    targetIssueId: number | null;
  } | null>(null);

  type HeaderInfo = { label: string; days: number; dates: Date[]; year: number; month: number; isNewYear: boolean; isNewMonth: boolean; yearSpan: number; monthSpan: number };

  const chartRef = useRef<HTMLDivElement>(null);
  const dayWidth = ZOOM_CONFIG[zoom].dayWidth;

  // Extract working hours
  const { workStartMinutes, workEndMinutes, snapMinutes } = useMemo(() => {
    let start = 9 * 60; // default 09:00
    let end = 18 * 60; // default 18:00
    let snapPoints = [9 * 60, 18 * 60];

    if (systemSettings) {
      if (systemSettings.startTime) {
        const [h, m] = systemSettings.startTime.split(':').map(Number);
        start = h * 60 + m;
      }
      if (systemSettings.endTime) {
        const [h, m] = systemSettings.endTime.split(':').map(Number);
        end = h * 60 + m;
      }
      if (systemSettings.managementTimes && systemSettings.managementTimes.length > 0) {
        snapPoints = systemSettings.managementTimes.map((t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        }).sort((a: number, b: number) => a - b);
      } else {
        snapPoints = [start, end];
      }
    }

    // ensure start < end
    if (start >= end) end = start + 60;

    return { workStartMinutes: start, workEndMinutes: end, snapMinutes: snapPoints };
  }, [systemSettings]);

  const [addModal, setAddModal] = useState<{
    isOpen: boolean;
    projectId: number;
    initialDueDate: string;
  }>({ isOpen: false, projectId: 0, initialDueDate: '' });

  const [commentModal, setCommentModal] = useState<{ issue: Issue; comments: IssueComment[] } | null>(null);
  const [commentModalLoading, setCommentModalLoading] = useState(false);

  const handleOpenCommentModal = useCallback(async (e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    e.stopPropagation();
    setCommentModalLoading(true);
    setCommentModal({ issue, comments: [] });
    try {
      const res = await api.get(`/issues/${issue.id}`);
      setCommentModal({ issue, comments: res.data.comments || [] });
    } finally {
      setCommentModalLoading(false);
    }
  }, []);

  // 折りたたまれたプロジェクトID
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());

  const toggleCollapse = useCallback((projectId: number) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // ズーム変更時の初期値設定
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const formatMonth = (y: number, m: number) => {
      const d = new Date(y, m, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    if (zoom === 'day') {
      // 日表示: 当月～5ヶ月後
      setStartValue(formatMonth(currentYear, currentMonth));
      setEndValue(formatMonth(currentYear, currentMonth + 5));
    } else if (zoom === 'month') {
      // 月表示: 当月～11ヶ月後
      setStartValue(formatMonth(currentYear, currentMonth));
      setEndValue(formatMonth(currentYear, currentMonth + 11));
    } else if (zoom === 'year') {
      // 年表示: 当年～4年後
      setStartValue(String(currentYear));
      setEndValue(String(currentYear + 4));
    }
  }, [zoom]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => {
      setTrackers(res.data.trackers);
      setStatuses(res.data.statuses);
      setAssignees(res.data.users);
    });
  }, []);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filterTrackerId && issue.trackerId !== filterTrackerId) return false;
      if (filterAssignedToId && issue.assignedToId !== filterAssignedToId) return false;
      if (filterStatusId && issue.statusId !== filterStatusId) return false;
      return true;
    });
  }, [issues, filterTrackerId, filterAssignedToId, filterStatusId]);

  const trackerColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    trackers.forEach((t, i) => { map[t.id] = TRACKER_COLORS[i % TRACKER_COLORS.length]; });
    return map;
  }, [trackers]);

  const { chartStart, totalDays, months } = useMemo((): { chartStart: Date; totalDays: number; months: HeaderInfo[] } => {
    if (!startValue || !endValue) return { chartStart: new Date(), totalDays: 0, months: [] };

    let start: Date;
    let end: Date;

    if (zoom === 'year') {
      start = new Date(Number(startValue), 0, 1);
      end = new Date(Number(endValue), 11, 31);
    } else {
      const [sy, sm] = startValue.split('-').map(Number);
      const [ey, em] = endValue.split('-').map(Number);
      start = new Date(sy, sm - 1, 1);
      end = new Date(ey, em, 0); // 指定月の末日
    }

    const total = Math.max(daysBetween(start, end) + 1, 1);
    let headerList: HeaderInfo[] = [];

    let current = new Date(start);
    while (current <= end) {
      if (zoom === 'day') {
        const day = current.getDate();
        const month = current.getMonth() + 1;
        const year = current.getFullYear();
        headerList.push({
          label: `${month}/${day}`,
          days: 1,
          dates: [new Date(current)],
          year,
          month,
          isNewYear: headerList.length === 0 || headerList[headerList.length - 1].year !== year,
          isNewMonth: headerList.length === 0 || headerList[headerList.length - 1].month !== month || headerList[headerList.length - 1].year !== year,
          yearSpan: 0,
          monthSpan: 0
        });
        current = addDays(current, 1);
      } else {
        // month or year zoom: group by months
        const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        const startDay = current.getDate() - 1;
        const remainingDays = Math.min(daysInMonth - startDay, daysBetween(current, end) + 1);
        const monthDates: Date[] = [];
        for (let i = 0; i < remainingDays; i++) {
          monthDates.push(new Date(current.getFullYear(), current.getMonth(), startDay + 1 + i));
        }
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        headerList.push({
          label: `${year}/${month}`,
          days: remainingDays,
          dates: monthDates,
          year,
          month,
          isNewYear: headerList.length === 0 || headerList[headerList.length - 1].year !== year,
          isNewMonth: true,
          yearSpan: 0,
          monthSpan: 0
        });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    }

    // スパン計算（年と月がいくつのセルにまたがるかを計算）
    for (let i = 0; i < headerList.length; i++) {
      const item = headerList[i];
      if (item.isNewYear) {
        let span = item.days;
        for (let j = i + 1; j < headerList.length && headerList[j].year === item.year; j++) {
          span += headerList[j].days;
        }
        item.yearSpan = span;
      }
      if (item.isNewMonth) {
        let span = item.days;
        for (let j = i + 1; j < headerList.length && headerList[j].month === item.month && headerList[j].year === item.year; j++) {
          span += headerList[j].days;
        }
        item.monthSpan = span;
      }
    }

    const finalStart = headerList.length > 0 ? headerList[0].dates[0] : start;
    const finalEnd = headerList.length > 0 ? headerList[headerList.length - 1].dates[headerList[headerList.length - 1].dates.length - 1] : end;
    const finalTotal = daysBetween(finalStart, finalEnd) + 1;

    return { chartStart: finalStart, totalDays: finalTotal, months: headerList };
  }, [zoom, startValue, endValue]);

  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offset = daysBetween(chartStart, today);
    if (offset < 0 || offset > totalDays) return null;
    return offset * dayWidth;
  }, [chartStart, totalDays, dayWidth]);

  const getOffset = useCallback((date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const start = new Date(chartStart);
    start.setHours(0, 0, 0, 0);
    const dayOffset = Math.round((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const minutes = date.getHours() * 60 + date.getMinutes();
    let fraction = 0;
    if (minutes <= workStartMinutes) {
      fraction = 0;
    } else if (minutes >= workEndMinutes) {
      fraction = 1.0;
    } else {
      fraction = (minutes - workStartMinutes) / (workEndMinutes - workStartMinutes);
    }

    return dayOffset + fraction;
  }, [chartStart, workStartMinutes, workEndMinutes]);

  const getBarPosition = useCallback((issue: Issue) => {
    // ドラッグ中のチケットはドラッグ状態の日付を使用
    if (drag && drag.issueId === issue.id) {
      const dragStartOffset = getOffset(drag.currentStartDate);
      const dragEndOffset = getOffset(drag.currentDueDate);
      const left = dragStartOffset * dayWidth;
      let width = (dragEndOffset - dragStartOffset) * dayWidth;

      if (width < Math.max(0.1, 0.1 * dayWidth)) width = Math.max(0.1, 0.1 * dayWidth);
      return { left, width };
    }

    const s = issue.startDate ? new Date(issue.startDate) : null;
    const h = issue.estimatedHours || 0;
    const d = issue.dueDate ? new Date(issue.dueDate) : null;
    if (!s && !d) return null;

    // バー左端: 開始日時を有効なスナップポイント（開始時刻・管理時刻）に切り捨て
    const start = s ? snapToStartPoint(s, systemSettings) : d!;
    // バー右端: 左端から工数（換算時間）を消費した日時を、有効な終了スナップポイントに切り上げ
    const rawEnd = s ? addConvertedHours(start, h, systemSettings) : d!;
    const end = s ? snapToEndPoint(rawEnd, systemSettings) : d!;

    const startOffset = getOffset(start);
    const endOffset = getOffset(end);

    const left = startOffset * dayWidth;
    let width = (endOffset - startOffset) * dayWidth;
    if (width < Math.max(0.1, 0.5 * dayWidth)) width = Math.max(0.1, 0.5 * dayWidth);

    // 範囲外のバーを調整
    const visibleLeft = Math.max(0, left);
    const visibleRight = Math.min(totalDays * dayWidth, left + width);
    const visibleWidth = visibleRight - visibleLeft;

    if (visibleWidth <= 0) return null;

    return { left: visibleLeft, width: visibleWidth };
  }, [getOffset, dayWidth, drag, totalDays, systemSettings]);

  // グリッド線
  const gridLines = useMemo(() => {
    const lines: { offset: number; bold: boolean }[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(chartStart, i);
      const dayOfWeek = date.getDay();
      if (zoom === 'day') {
        lines.push({ offset: i * dayWidth, bold: dayOfWeek === 1 });
      } else if (zoom === 'month' && date.getDate() === 1) {
        lines.push({ offset: i * dayWidth, bold: true });
      } else if (zoom === 'year') {
        if (date.getDate() === 1) {
          lines.push({ offset: i * dayWidth, bold: date.getMonth() === 0 });
        }
      }
    }
    return lines;
  }, [chartStart, totalDays, dayWidth, zoom]);

  // showProject時にプロジェクトごとにグループ化（ツリー表示対応）
  const groupedIssues = useMemo(() => {
    if (!showProject) return [{ projectName: '', projectId: 0, projectDueDate: null, issues: filteredIssues, depth: 0, hasChildren: false }];

    const groups: Record<number, { projectName: string; projectId: number; projectDueDate: string | null; issues: Issue[]; depth: number }> = {};

    // Initialize all projects (even those without issues)
    projects.forEach((project) => {
      groups[project.id] = {
        projectName: project.name,
        projectId: project.id,
        projectDueDate: project.dueDate || null,
        issues: [],
        depth: 0,
      };
    });

    // Add filtered issues to their projects
    filteredIssues.forEach((issue) => {
      const pid = issue.projectId;
      if (!groups[pid]) {
        groups[pid] = {
          projectName: issue.project?.name || `Project ${pid}`,
          projectId: pid,
          projectDueDate: null,
          issues: [],
          depth: 0,
        };
      }
      groups[pid].issues.push(issue);
    });

    // Build parent -> children map
    const childrenMap: Record<number, number[]> = {};
    const projectIds = new Set(Object.keys(groups).map(Number));
    projects.forEach((project) => {
      const parentId = project.parentId;
      // Only link if both parent and child exist in our groups
      if (parentId && projectIds.has(parentId)) {
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(project.id);
      }
    });

    // Identify root projects (no parent, or parent not in the list)
    const rootIds = projects
      .filter((p) => !p.parentId || !projectIds.has(p.parentId))
      .map((p) => p.id)
      .filter((id) => projectIds.has(id));

    // DFS traversal to produce ordered flat list with depth
    const result: { projectName: string; projectId: number; projectDueDate: string | null; issues: Issue[]; depth: number; hasChildren: boolean }[] = [];
    const visited = new Set<number>();

    const traverse = (id: number, depth: number, ancestorCollapsed: boolean) => {
      if (visited.has(id)) return;
      visited.add(id);
      const group = groups[id];
      if (!group) return;
      group.depth = depth;
      const children = (childrenMap[id] || []).sort((a, b) =>
        (groups[a]?.projectName || '').localeCompare(groups[b]?.projectName || '')
      );
      const hasChildren = children.length > 0;
      if (!ancestorCollapsed) {
        result.push({ ...group, hasChildren });
      }
      const isCollapsed = collapsedProjects.has(id);
      children.forEach((childId) => traverse(childId, depth + 1, ancestorCollapsed || isCollapsed));
    };

    rootIds.sort((a, b) =>
      (groups[a]?.projectName || '').localeCompare(groups[b]?.projectName || '')
    ).forEach((id) => traverse(id, 0, false));

    // Append any projects not reachable (edge case)
    Object.keys(groups).map(Number).forEach((id) => {
      if (!visited.has(id)) result.push({ ...groups[id], depth: 0, hasChildren: false });
    });

    return result;
  }, [filteredIssues, projects, showProject, collapsedProjects]);

  // 各チケットの絶対位置を計算（線引き用）
  const issuePositions = useMemo(() => {
    const pos: Record<number, { left: number; width: number; top: number }> = {};
    let currentIndex = 0;

    groupedIssues.forEach((group) => {
      // プロジェクト行の分をカウント
      if (showProject) {
        currentIndex++;
      }

      group.issues.forEach((issue) => {
        const bar = getBarPosition(issue);
        if (bar) {
          // ヘッダーの高さを考慮
          // 日表示: 24 (年) + 24 (月) + 24 (日) + 24 (曜日) = 96
          // 月表示: 24 (年) + 24 (月) = 48
          // 年表示: 24 (年) = 24
          const headerHeight = zoom === 'day' ? 96 : zoom === 'month' ? 48 : 24;
          pos[issue.id] = {
            left: bar.left,
            width: bar.width,
            top: headerHeight + currentIndex * 24 + 12, // 12 is bar center
          };
        }
        currentIndex++;
      });
    });
    return pos;
  }, [groupedIssues, getBarPosition, showProject, zoom]);

  // チケット期間からプロジェクトバーの位置を算出（グレー）
  const getProjectBarFromIssues = useCallback((groupIssues: Issue[]) => {
    let minStartOffset: number | null = null;
    let maxEndOffset: number | null = null;
    groupIssues.forEach((issue) => {
      const s = issue.startDate ? new Date(issue.startDate) : null;
      const h = issue.estimatedHours || 0;
      const d = issue.dueDate ? new Date(issue.dueDate) : null;
      if (!s && !d) return;

      const start = s ? snapToStartPoint(s, systemSettings) : d!;
      const rawEnd = s ? addConvertedHours(start, h, systemSettings) : d!;
      const end = s ? snapToEndPoint(rawEnd, systemSettings) : d!;

      const startOffset = getOffset(start);
      const endOffset = getOffset(end);

      if (minStartOffset === null || startOffset < minStartOffset) minStartOffset = startOffset;
      if (maxEndOffset === null || endOffset > maxEndOffset) maxEndOffset = endOffset;
    });

    if (minStartOffset === null && maxEndOffset === null) return null;
    const start = minStartOffset || maxEndOffset!;
    const end = maxEndOffset || minStartOffset!;
    const left = start * dayWidth;
    let width = (end - start) * dayWidth;

    if (width < Math.max(0.1, 0.5 * dayWidth)) width = Math.max(0.1, 0.5 * dayWidth);

    // 範囲外のバーを調整
    const visibleLeft = Math.max(0, left);
    const visibleRight = Math.min(totalDays * dayWidth, left + width);
    const visibleWidth = visibleRight - visibleLeft;

    if (visibleWidth <= 0) return null;

    return { left: visibleLeft, width: visibleWidth };
  }, [getOffset, dayWidth, totalDays]);

  // プロジェクト期限日バーの位置を算出（赤）
  const getProjectDueDateBar = useCallback((projectDueDate: string | null) => {
    if (!projectDueDate) return null;
    const dueDate = new Date(projectDueDate);
    const offset = getOffset(dueDate);

    if (offset < 0 || offset > totalDays) return null;

    // 期限日は縦線で表示
    return { left: offset * dayWidth };
  }, [getOffset, dayWidth, totalDays]);

  // ドラッグハンドラー
  const handleMouseDown = useCallback((e: React.MouseEvent, issue: Issue, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();
    const s = issue.startDate ? new Date(issue.startDate) : null;
    const h = issue.estimatedHours || 0;
    const d = issue.dueDate ? new Date(issue.dueDate) : null;
    if (!s && !d) return;

    // 表示上のバー位置と一致するよう、スナップ済みの日時をドラッグ起点にする
    const start = s ? snapToStartPoint(s, systemSettings) : d!;
    const rawEnd = s ? addConvertedHours(start, h, systemSettings) : d!;
    const end = s ? snapToEndPoint(rawEnd, systemSettings) : d!;

    setDrag({
      issueId: issue.id,
      type,
      startX: e.clientX,
      origStartDate: start,
      origDueDate: end,
      origEstimatedHours: h,
      currentStartDate: start,
      currentDueDate: end,
    });
    setTooltip(null);
  }, [systemSettings]);

  useEffect(() => {
    if (!drag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - drag.startX;
      const deltaDayFraction = deltaX / dayWidth;

      const origStartOffset = getOffset(drag.origStartDate);
      const origEndOffset = getOffset(drag.origDueDate);

      let newStartOffset = origStartOffset;
      let newEndOffset = origEndOffset;

      if (drag.type === 'move') {
        newStartOffset = origStartOffset + deltaDayFraction;
        newEndOffset = origEndOffset + deltaDayFraction;
      } else if (drag.type === 'resize-left') {
        newStartOffset = origStartOffset + deltaDayFraction;
        if (newStartOffset > origEndOffset) newStartOffset = origEndOffset;
      } else if (drag.type === 'resize-right') {
        newEndOffset = origEndOffset + deltaDayFraction;
        if (newEndOffset < origStartOffset) newEndOffset = origStartOffset;
      }

      const offsetToDate = (offset: number, side: 'start' | 'end' | 'any') => {
        const fullDays = Math.floor(offset);

        const candidateDays = [fullDays - 1, fullDays, fullDays + 1];
        let bestDate: Date | null = null;
        let minDiff = Infinity;

        for (const day of candidateDays) {
          if (day < 0 || day >= totalDays) continue;

          let candidateSnaps: number[];
          if (side === 'start') {
            candidateSnaps = [workStartMinutes, ...snapMinutes].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
          } else if (side === 'end') {
            candidateSnaps = [...snapMinutes, workEndMinutes].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
          } else {
            candidateSnaps = [workStartMinutes, ...snapMinutes, workEndMinutes].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
          }

          for (const snapMin of candidateSnaps) {
            const d = new Date(chartStart);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + day);
            d.setHours(Math.floor(snapMin / 60), snapMin % 60, 0, 0);

            const dOffset = getOffset(d);
            const diff = Math.abs(offset - dOffset);
            if (diff < minDiff) {
              minDiff = diff;
              bestDate = d;
            }
          }
        }
        return bestDate || new Date();
      };

      // For resize-right, keep the original start date unchanged (no re-snapping).
      // For resize-left, keep the original end date unchanged (no re-snapping).
      let newStart: Date;
      let newEnd: Date;

      if (drag.type === 'move') {
        newStart = offsetToDate(newStartOffset, 'start');
        // 移動時は元の工数を維持したまま終了日時を計算し、さらに有効な終了スナップポイントまで切り上げ
        const rawEnd = addConvertedHours(newStart, drag.origEstimatedHours, systemSettings);
        newEnd = snapToEndPoint(rawEnd, systemSettings);
      } else if (drag.type === 'resize-left') {
        newStart = offsetToDate(newStartOffset, 'start');
        newEnd = drag.origDueDate; // 右端固定
      } else { // resize-right
        newStart = drag.origStartDate; // 左端固定
        newEnd = offsetToDate(newEndOffset, 'end');
      }

      setDrag((prev) => prev ? { ...prev, currentStartDate: newStart, currentDueDate: newEnd } : null);
    };

    const handleMouseUp = async () => {
      if (drag) {
        const data: { startDate?: string; estimatedHours?: number; dueDate?: string } = {};
        if (drag.type === 'move' || drag.type === 'resize-left') {
          data.startDate = formatDateTime(drag.currentStartDate);
        }
        if (drag.type === 'resize-right' || drag.type === 'resize-left') {
          data.estimatedHours = calcConversionHours(drag.currentStartDate, drag.currentDueDate, systemSettings);
        }
        await onUpdateIssue(drag.issueId, data);
      }
      setDrag(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, dayWidth, onUpdateIssue, getOffset, chartStart, workStartMinutes, workEndMinutes, snapMinutes, systemSettings]);

  const handleSortMouseDown = useCallback((e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    e.stopPropagation();
    setSortDrag({
      issue,
      startY: e.clientY,
      currentY: e.clientY,
      targetIssueId: null,
    });
  }, []);

  const handleRelationMouseDown = useCallback((e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    e.stopPropagation();
    setRelationDrag({
      fromIssue: issue,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      toIssueId: null,
    });
  }, []);

  useEffect(() => {
    if (!relationDrag && !sortDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (relationDrag) {
        document.body.style.cursor = 'grabbing';
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const row = elements.find(el => el.hasAttribute('data-issue-id'));
        const toId = row ? Number(row.getAttribute('data-issue-id')) : null;

        setRelationDrag(prev => prev ? {
          ...prev,
          currentX: e.clientX,
          currentY: e.clientY,
          toIssueId: toId !== prev.fromIssue.id ? toId : null,
        } : null);
      }

      if (sortDrag) {
        document.body.style.cursor = 'move';
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const row = elements.find(el => el.hasAttribute('data-issue-id'));
        const targetId = row ? Number(row.getAttribute('data-issue-id')) : null;

        setSortDrag(prev => prev ? {
          ...prev,
          currentY: e.clientY,
          targetIssueId: targetId !== prev.issue.id ? targetId : null,
        } : null);
      }
    };

    const handleMouseUp = async () => {
      // Immediately reset cursor and drag state to avoid persistent "move" cursor
      document.body.style.cursor = '';
      const currentRelationDrag = relationDrag;
      const currentSortDrag = sortDrag;
      setRelationDrag(null);
      setSortDrag(null);

      if (currentRelationDrag) {
        if (currentRelationDrag.toIssueId && onRelationCreated) {
          await onRelationCreated(currentRelationDrag.fromIssue.id, currentRelationDrag.toIssueId);
        }
      }

      if (currentSortDrag) {
        if (currentSortDrag.targetIssueId) {
          const fromId = currentSortDrag.issue.id;
          const toId = currentSortDrag.targetIssueId;

          const newIssues = [...issues];
          const fromIdx = newIssues.findIndex(i => i.id === fromId);
          const toIdx = newIssues.findIndex(i => i.id === toId);

          if (fromIdx !== -1 && toIdx !== -1) {
            const [movedItem] = newIssues.splice(fromIdx, 1);
            newIssues.splice(toIdx, 0, movedItem);

            const reordered = newIssues.map((issue, index) => ({
              id: issue.id,
              position: index
            }));

            try {
              await api.put('/issues/reorder', { issues: reordered });
              onIssueCreated?.();
            } catch (err) {
              console.error('Failed to reorder:', err);
            }
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [relationDrag, sortDrag, onRelationCreated, issues, onIssueCreated]);

  const handleBarHover = useCallback((e: React.MouseEvent, issue: Issue) => {
    if (drag) return;
    setTooltip({ issue, x: e.clientX, y: e.clientY });
  }, [drag]);

  const leftColWidth = customLeftColWidth !== null ? customLeftColWidth : (showProject ? 360 : 300);

  // プロジェクト行クリック時のハンドラー
  const handleProjectRowClick = useCallback((e: React.MouseEvent, projectId: number) => {
    // クリック位置から日付を計算
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const daysOffset = Math.floor(x / dayWidth);
    const clickedDate = addDays(chartStart, daysOffset);

    const year = clickedDate.getFullYear();
    const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
    const day = String(clickedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // モーダルを開く
    setAddModal({ isOpen: true, projectId, initialDueDate: dateStr });
  }, [chartStart, dayWidth]);

  const resizer = (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-sky-400 z-20"
      onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = leftColWidth;
        const onMouseMove = (moveEvent: MouseEvent) => {
          setCustomLeftColWidth(Math.max(100, Math.min(800, startWidth + (moveEvent.clientX - startX))));
        };
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }}
    />
  );

  // すべての親プロジェクトIDを取得
  const parentProjectIds = useMemo(() => {
    return new Set(
      groupedIssues
        .filter((g) => g.hasChildren)
        .map((g) => g.projectId)
    );
  }, [groupedIssues]);

  const collapseAll = useCallback(() => {
    setCollapsedProjects(new Set(parentProjectIds));
  }, [parentProjectIds]);

  const expandAll = useCallback(() => {
    setCollapsedProjects(new Set());
  }, []);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = [];
    for (let i = currentYear - 5; i <= currentYear + 20; i++) {
      result.push(i);
    }
    return result;
  }, []);

  return (
    <div className="relative">
      {/* ツールバー */}
      <div className="bg-white rounded-lg shadow p-3 mb-4 flex flex-wrap items-center gap-3">
        {/* ズーム */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">ズーム:</span>
          {(['day', 'month', 'year'] as ZoomLevel[]).map((z) => (
            <button key={z} onClick={() => setZoom(z)}
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
                onClick={collapseAll}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                title="すべて折りたたむ"
              >
                <FoldVertical size={13} />
                <span>すべて折りたたむ</span>
              </button>
              <button
                onClick={expandAll}
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
              <select value={startValue} onChange={(e) => setStartValue(e.target.value)} className="border rounded px-1 py-1 text-xs">
                {years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <span className="text-gray-400">〜</span>
              <select value={endValue} onChange={(e) => setEndValue(e.target.value)} className="border rounded px-1 py-1 text-xs">
                {years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <input type="month" value={startValue} onChange={(e) => setStartValue(e.target.value)}
                className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
              <span className="text-gray-400">〜</span>
              <input type="month" value={endValue} onChange={(e) => setEndValue(e.target.value)}
                className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* フィルター */}
        <select value={filterTrackerId} onChange={(e) => setFilterTrackerId(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-2 py-1 text-xs">
          <option value="">全トラッカー</option>
          {trackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={filterStatusId} onChange={(e) => setFilterStatusId(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-2 py-1 text-xs focus:outline-none">
          <option value="">全ステータス</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select value={filterAssignedToId} onChange={(e) => setFilterAssignedToId(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-2 py-1 text-xs focus:outline-none">
          <option value="">全担当者</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.lastName} {a.firstName}</option>)}
        </select>

        <div className="ml-auto text-xs text-gray-400">{filteredIssues.length} 件</div>
      </div>

      {/* チャート */}
      {!showProject && filteredIssues.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          チケットがありません
        </div>
      ) : showProject && groupedIssues.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          プロジェクトがありません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-auto relative" ref={chartRef} style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="relative" style={{ minWidth: totalDays * dayWidth + leftColWidth }}>
            {/* ヘッダー部 */}
            {/* 1段目：年（全モードで表示） */}
            <div className="flex border-b sticky top-0 z-30 bg-white h-6 items-center">
              <div style={{ width: leftColWidth }} className="flex-shrink-0 h-full bg-gray-50 border-r relative sticky left-0 z-40">{resizer}</div>
              <div className="flex relative h-full items-center">
                {months.map((m, i) => {
                  if (!m.isNewYear) return null;
                  return (
                    <div key={`year-${i}`} style={{ width: m.yearSpan * dayWidth }} className="text-center text-xs h-full flex items-center justify-center border-l bg-gray-50 text-gray-500 font-medium whitespace-nowrap overflow-hidden">
                      {m.year}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2段目：月（日表示・月表示のみ） */}
            {(zoom === 'day' || zoom === 'month') && (
              <div className="flex border-b sticky top-6 z-30 bg-white h-6 items-center">
                <div style={{ width: leftColWidth }} className="flex-shrink-0 h-full bg-gray-50 border-r relative sticky left-0 z-40">{resizer}</div>
                <div className="flex relative h-full items-center">
                  {months.map((m, i) => {
                    if (!m.isNewMonth) return null;
                    return (
                      <div key={`month-${i}`} style={{ width: m.monthSpan * dayWidth }} className="text-center text-xs h-full flex items-center justify-center border-l bg-gray-50 text-gray-500 font-medium whitespace-nowrap overflow-hidden">
                        {m.month}月
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3段目：日（日表示のみ） */}
            {zoom === 'day' && (
              <>
                <div className="flex border-b sticky top-12 z-30 bg-white h-6 items-center">
                  <div style={{ width: leftColWidth }} className="flex-shrink-0 h-full bg-gray-50 border-r relative sticky left-0 z-40">{resizer}</div>
                  <div className="flex relative h-full items-center">
                    {months.map((m, i) => (
                      <div key={`day-num-${i}`} style={{ width: m.days * dayWidth }} className="text-center text-[10px] h-full flex items-center justify-center border-l bg-gray-50 text-gray-500">
                        {m.dates[0].getDate()}
                      </div>
                    ))}
                  </div>
                </div>
                {/* 4段目：曜日（日表示のみ） */}
                <div className="flex border-b sticky top-[72px] z-30 bg-white h-6 items-center">
                  <div style={{ width: leftColWidth }} className="flex-shrink-0 h-full bg-gray-50 border-r relative sticky left-0 z-40">{resizer}</div>
                  <div className="flex relative h-full items-center">
                    {months.map((m, i) => {
                      const dayOfWeek = getDayOfWeekName(m.dates[0]);
                      const isWeekend = m.dates[0].getDay() === 0 || m.dates[0].getDay() === 6;
                      return (
                        <div key={`day-week-${i}`} style={{ width: m.days * dayWidth }}
                          className={`text-center text-[10px] h-full flex items-center justify-center border-l bg-gray-50 font-medium ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                          {dayOfWeek}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* チケット行 */}
            {groupedIssues.map((group) => (
              <div key={group.projectId}>
                {showProject && (() => {
                  const projectIssuesBar = getProjectBarFromIssues(group.issues);
                  const projectDueDateBar = getProjectDueDateBar(group.projectDueDate);
                  const indentPx = group.depth * 16;
                  const isCollapsed = collapsedProjects.has(group.projectId);
                  return (
                    <div className="flex border-b bg-slate-100 group">
                      <div style={{ width: leftColWidth }} className="flex-shrink-0 py-0.5 text-xs font-semibold text-slate-700 border-r truncate flex items-center sticky left-0 z-20 bg-slate-100 group-hover:bg-slate-200" title={group.projectName}>
                        <span style={{ paddingLeft: indentPx + 4 }} className="flex items-center gap-1 min-w-0">
                          {group.hasChildren ? (
                            <button
                              onClick={() => toggleCollapse(group.projectId)}
                              className="flex-shrink-0 w-4 h-4 text-[10px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded"
                              title={isCollapsed ? '展開' : '折りたたむ'}
                            >
                              {isCollapsed ? '▶' : '▼'}
                            </button>
                          ) : (
                            <span className="flex-shrink-0 w-4" />
                          )}
                          {group.depth > 0 && <span className="text-slate-400 flex-shrink-0">└</span>}
                          <Link to={`/projects/${group.projectId}`} className="hover:text-sky-600 truncate">{group.projectName}</Link>
                        </span>
                      </div>
                      <div className="relative flex-1 cursor-pointer group-hover:bg-slate-200 transition-colors" title="クリックしてチケット追加" style={{ height: 24 }} onClick={(e) => handleProjectRowClick(e, group.projectId)}>
                        {/* グリッド線 */}
                        {gridLines.map((line, i) => (
                          <div key={i} className="absolute top-0 bottom-0" style={{
                            left: line.offset, width: 1,
                            backgroundColor: line.bold ? '#D1D5DB' : '#E5E7EB',
                          }} />
                        ))}
                        {/* 今日の線 */}
                        {todayOffset !== null && (
                          <div className="absolute top-0 bottom-0" style={{ left: todayOffset, width: 2, backgroundColor: '#EF4444', zIndex: 5 }} />
                        )}
                        {/* チケット期間バー */}
                        {projectIssuesBar && (
                          <div className="absolute top-1 rounded"
                            style={{ left: projectIssuesBar.left, width: projectIssuesBar.width, height: 16, backgroundColor: '#475569', zIndex: 10 }}
                          />
                        )}
                        {/* プロジェクト期限日マーカー */}
                        {projectDueDateBar && (
                          <div className="absolute top-0 bottom-0 cursor-help"
                            style={{ left: projectDueDateBar.left, width: 6, backgroundColor: '#EF4444', zIndex: 15 }}
                            onMouseEnter={(e) => setTooltip({ projectDueDate: group.projectDueDate, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            onMouseMove={(e) => setTooltip({ projectDueDate: group.projectDueDate, x: e.clientX, y: e.clientY })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {!collapsedProjects.has(group.projectId) && group.issues.map((issue) => {
                  const bar = getBarPosition(issue);
                  const color = issue.status?.isClosed ? '#9CA3AF' : (trackerColorMap[issue.trackerId] || '#0EA5E9');
                  const isDragging = drag?.issueId === issue.id;

                  return (
                    <div key={issue.id} className="flex border-b group hover:bg-gray-50 text-[11px]">
                      <div style={{ width: leftColWidth }} className="flex-shrink-0 px-2 py-0.5 text-xs truncate border-r flex items-center sticky left-0 z-20 bg-white group-hover:bg-gray-50" data-issue-id={issue.id}>
                        {showProject && <span className="inline-block w-4 flex-shrink-0" />}
                        {/* ドラッグハンドル */}
                        <div
                          className="p-1 -m-1 mr-0.5 text-gray-400 hover:text-sky-500 cursor-move flex-shrink-0"
                          onMouseDown={(e) => handleSortMouseDown(e, issue)}
                          title="ドラッグして順序を並び替え"
                        >
                          <GripVertical size={14} className="pointer-events-none" />
                        </div>
                        <span className="text-gray-400 mr-1 flex-shrink-0">#{issue.id}</span>
                        {issue.tracker && (
                          <span className="text-[10px] px-1 py-0 rounded mr-1 text-white flex-shrink-0" style={{ backgroundColor: trackerColorMap[issue.trackerId] || '#0EA5E9' }}>
                            {issue.tracker.name}
                          </span>
                        )}
                        <Link to={`/issues/${issue.id}`} className="text-sky-600 hover:underline truncate">{issue.subject}</Link>
                        {(issue._count?.comments ?? 0) > 0 && (
                          <button
                            className="ml-1 flex-shrink-0 text-gray-400 hover:text-sky-500"
                            onClick={(e) => handleOpenCommentModal(e, issue)}
                            title={`コメント ${issue._count!.comments}件`}
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}
                      </div>
                      <div className={`relative flex-1 ${(relationDrag?.toIssueId === issue.id || sortDrag?.targetIssueId === issue.id) ? 'bg-sky-50' : ''}`} style={{ height: 24 }} data-issue-id={issue.id}>
                        {/* グリッド線 */}
                        {gridLines.map((line, i) => (
                          <div key={i} className="absolute top-0 bottom-0" style={{
                            left: line.offset, width: 1,
                            backgroundColor: line.bold ? '#D1D5DB' : '#E5E7EB',
                          }} />
                        ))}

                        {/* 今日の線 */}
                        {todayOffset !== null && (
                          <div className="absolute top-0 bottom-0" style={{ left: todayOffset, width: 2, backgroundColor: '#EF4444', zIndex: 5 }} />
                        )}

                        {/* バー */}
                        {bar && (
                          <div
                            className={`absolute top-1 rounded group ${isDragging ? 'opacity-80' : ''}`}
                            style={{ left: bar.left, width: bar.width, height: 16, backgroundColor: color, zIndex: 10 }}
                            onMouseEnter={(e) => handleBarHover(e, issue)}
                            onMouseLeave={() => !drag && setTooltip(null)}
                            onMouseMove={(e) => !drag && setTooltip({ issue, x: e.clientX, y: e.clientY })}
                          >
                            {/* 進捗 */}
                            {issue.doneRatio > 0 && (
                              <div className="h-full rounded-l bg-black/20" style={{ width: `${issue.doneRatio}%` }} />
                            )}

                            {/* ドラッグハンドル & 移動用透明エリア & 関係ドラッグ */}
                            <div className="absolute inset-0 flex items-center">
                              <div
                                className="h-full w-4 flex items-center justify-center cursor-crosshair hover:bg-black/10 rounded-l"
                                onMouseDown={(e) => handleRelationMouseDown(e, issue)}
                                title="ドラッグして関連チケットを設定"
                              >
                                <GripVertical size={10} className="text-white/70" />
                              </div>
                              <div
                                className="flex-1 h-full cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => handleMouseDown(e, issue, 'move')}
                                title="ドラッグして移動（日付変更）"
                              />
                            </div>

                            {/* ドラッグ: 左リサイズ */}
                            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize"
                              onMouseDown={(e) => handleMouseDown(e, issue, 'resize-left')} />

                            {/* ドラッグ: 右リサイズ */}
                            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
                              onMouseDown={(e) => handleMouseDown(e, issue, 'resize-right')} />

                            {/* ドラッグ日付プレビュー */}
                            {isDragging && drag && (
                              <div className="absolute -top-5 left-0 text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-20">
                                {formatDateDisplay(drag.currentStartDate)} 〜 {formatDateDisplay(drag.currentDueDate)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 期日マーカー（赤い縦線） */}
                        {!isDragging && issue.dueDate && (() => {
                          const d = new Date(issue.dueDate);
                          const left = daysBetween(chartStart, d);
                          if (left < 0 || left > totalDays) return null;
                          return (
                            <div
                              className="absolute top-0 bottom-0 w-1 bg-red-500 z-[11]"
                              style={{ left: left * dayWidth }}
                              title={`期日: ${new Date(issue.dueDate).toLocaleDateString('ja-JP')}`}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* 関係線 (SVG) */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              style={{ zIndex: 1, left: leftColWidth, width: totalDays * dayWidth, height: '100%' }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="4"
                  refX="5"
                  refY="2"
                  orient="auto"
                >
                  <polygon points="0 0, 6 2, 0 4" fill="#64748b" />
                </marker>
              </defs>
              {filteredIssues.map((issue) => {
                const fromPos = issuePositions[issue.id];
                if (!fromPos || !issue.relationsFrom) return null;

                return issue.relationsFrom.map((rel) => {
                  const toPos = issuePositions[rel.issueToId];
                  if (!toPos) return null;

                  return (
                    <g key={`${issue.id}-${rel.issueToId}`}>
                      {(() => {
                        const isPredecessorFrom = ['precedes', 'blocks'].includes(rel.relationType);
                        const predPos = isPredecessorFrom ? fromPos : toPos;
                        const succPos = isPredecessorFrom ? toPos : fromPos;

                        // 始点: 先行チケットの終端 (右端)
                        const x1 = predPos.left + predPos.width;
                        const y1 = predPos.top;
                        // 終点: 後行チケットの始端 (左端)
                        const x2 = succPos.left;
                        const y2 = succPos.top;

                        // かぎ足の曲がり角: 先行チケットの右側 10px か、中間点
                        const midX = Math.max(x1 + 10, x1 + (x2 - x1) / 2);

                        return (
                          <polyline
                            points={`${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="1.5"
                            markerEnd="url(#arrowhead)"
                            strokeDasharray={['blocked_by', 'blocks'].includes(rel.relationType) ? "4 2" : "none"}
                          />
                        );
                      })()}
                    </g>
                  );
                });
              })}
            </svg>

            {/* ヘッダー部の今日ラベル */}
            {todayOffset !== null && (
              <div className="absolute top-0 z-40" style={{ left: todayOffset + leftColWidth - 12 }}>
                <span className="text-xs bg-red-500 text-white px-1 rounded shadow-sm">今日</span>
              </div>
            )}
          </div>
        </div>
      )}


      {/* コメントモーダル */}
      <Modal
        isOpen={commentModal !== null}
        onClose={() => setCommentModal(null)}
        title={commentModal ? `#${commentModal.issue.id} ${commentModal.issue.subject}` : ''}
      >
        {commentModalLoading ? (
          <div className="text-center text-sm text-gray-500 py-8">読み込み中...</div>
        ) : (
          <div className="space-y-4">
            {commentModal?.comments.length === 0 ? (
              <p className="text-sm text-gray-400">コメントはありません</p>
            ) : (
              commentModal?.comments.map((c) => (
                <div key={c.id} className="border-l-2 border-sky-200 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{c.user.lastName} {c.user.firstName}</span>
                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('ja-JP')}</span>
                  </div>
                  <div className="text-sm text-gray-700 prose prose-sm max-w-none prose-p:my-1">
                    <MarkdownRenderer content={c.content} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* チケット追加モーダル */}
      <Modal
        isOpen={addModal.isOpen}
        onClose={() => setAddModal({ ...addModal, isOpen: false })}
        title="新規チケット作成"
      >
        <IssueForm
          projectId={String(addModal.projectId)}
          initialDueDate={addModal.initialDueDate}
          onSuccess={() => {
            setAddModal({ ...addModal, isOpen: false });
            onIssueCreated?.();
          }}
          onCancel={() => setAddModal({ ...addModal, isOpen: false })}
        />
      </Modal>

      {/* ツールチップ */}
      {tooltip && !drag && (
        <div className="fixed z-50 bg-slate-800 text-white rounded-lg shadow-xl px-4 py-3 text-xs pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          {tooltip.issue ? (
            <>
              <div className="font-semibold mb-1">{tooltip.issue.subject}</div>
              <div className="space-y-0.5 text-slate-300">
                {tooltip.issue.tracker && <div>トラッカー: {tooltip.issue.tracker.name}</div>}
                {tooltip.issue.startDate && <div>開始日時: {formatDateDisplay(new Date(tooltip.issue.startDate))}</div>}
                {tooltip.issue.startDate && (
                  <div>終了日時: {formatDateDisplay(addConvertedHours(snapToStartPoint(new Date(tooltip.issue.startDate), systemSettings), tooltip.issue.estimatedHours || 0, systemSettings))}</div>
                )}
                {tooltip.issue.dueDate && <div>期日: {new Date(tooltip.issue.dueDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>}
                {tooltip.issue.assignedTo && <div>担当: {tooltip.issue.assignedTo.lastName} {tooltip.issue.assignedTo.firstName}</div>}
                <div>進捗: {tooltip.issue.doneRatio}%</div>
              </div>
            </>
          ) : tooltip.projectDueDate ? (
            <div>
              <div className="font-semibold mb-1">プロジェクト期限日</div>
              <div className="text-slate-300">{new Date(tooltip.projectDueDate).toLocaleDateString('ja-JP')}</div>
            </div>
          ) : null}
        </div>
      )}

      {/* 関係ドラッグ中の線 (最上位) */}
      {relationDrag && (
        <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
          <defs>
            <marker id="drag-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#0EA5E9" />
            </marker>
          </defs>
          <line
            x1={relationDrag.startX}
            y1={relationDrag.startY}
            x2={relationDrag.currentX}
            y2={relationDrag.currentY}
            stroke="#0EA5E9"
            strokeWidth="3"
            markerEnd="url(#drag-arrowhead)"
            strokeDasharray="5,5"
          />
        </svg>
      )}
    </div>
  );
}
