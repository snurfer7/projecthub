import { useState, useEffect, useMemo, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { FoldVertical, UnfoldVertical, MessageSquare, Columns3, GripVertical } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueComment, Tracker, IssueStatus, IssuePriority, Project, SystemSetting } from '../types';
import Modal from './Modal';
import { IssueFormModal } from './IssueForm';
import IssueDetail from './IssueDetail';
import MarkdownRenderer from './MarkdownRenderer';
import { useAuth } from '../hooks/useAuth';
import { formatEstimatedHours, formatDateToYYYYMMDD } from '../utils/format';
import { addWorkingDays, advanceToWorkingDay, isNonWorkingDay } from '../utils/holidayCalendar';
import Combobox from './Combobox';
import CustomDatePicker from './CustomDatePicker';
import { filterProjectsKeepingAncestorsOfTicketed, sortSiblingProjects, type ProjectListSort } from '../utils/projectTree';
import { orderIssuesHierarchically, type IssueListSort } from '../utils/issueSort';
import type { PermissionMap } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { prefetchProjectPermissions, projectMapCanInput, getCachedProjectPermissions } from '../utils/projectPermissionsCache';
import { formatIssueAssignees, issueHasAssigneeUser, isIssueUnassigned } from '../utils/issueAssignees';
import {
  ganttColumnDef,
  ganttColumnLabel,
  normalizeGanttColumns,
  sumGanttColumnWidths,
  visibleGanttColumns,
  type GanttColumnConfig,
  type GanttColumnKey,
} from '../utils/ganttColumns';
import GanttColumnSettingsModal from './GanttColumnSettingsModal';

interface GanttChartProps {
  issues: Issue[];
  projects?: Project[];
  showProject?: boolean;
  /** showProject 時、チケット0件のプロジェクト行を表示するか（既定 true） */
  showEmptyProjects?: boolean;
  /** プロジェクトの並び替え（兄弟間。親子のまとまりは維持） */
  projectSort?: ProjectListSort[];
  /** チケットの並び替え（兄弟間。親子のまとまりは維持） */
  issueSort?: IssueListSort[];
  /** チケット作成・編集モーダル用のプロジェクトロール権限（単一プロジェクト時） */
  issueFormPermissions?: PermissionMap;
  onUpdateIssue: (id: number, data: { startDate?: string; endDate?: string; dueDate?: string }) => Promise<void>;
  onIssueCreated?: () => void;
  onRelationCreated?: (fromId: number, toId: number) => Promise<void>;
  systemSettings?: SystemSetting;
  zoom?: ZoomLevel;
  onZoomChange?: (zoom: ZoomLevel) => void;
  startValue?: string;
  onStartValueChange?: (value: string) => void;
  endValue?: string;
  onEndValueChange?: (value: string) => void;
  filterTrackerIds?: (number | string)[];
  onFilterTrackerIdsChange?: (values: (number | string)[]) => void;
  filterStatusIds?: (number | string)[];
  onFilterStatusIdsChange?: (values: (number | string)[]) => void;
  filterAssignedToIds?: (number | string)[];
  onFilterAssignedToIdsChange?: (values: (number | string)[]) => void;
  filterAssignedToGroupIds?: (number | string)[];
  filterAssignedToGroupMemberIds?: (number | string)[];
  /** true のとき担当未設定チケットを担当者条件の OR 対象に含める */
  filterIncludeUnassigned?: boolean;
  collapsedProjects?: Set<number>;
  onCollapsedProjectsChange?: (collapsed: Set<number>) => void;
}

type ZoomLevel = 'day' | 'month' | 'year';

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 30, label: '日' },
  month: { dayWidth: 4, label: '月' },
  year: { dayWidth: 1.5, label: '年' },
};

/** 行コンテンツ高さ (px)。タイムラインセルの height */
const GANTT_ROW_CONTENT_HEIGHT = 24;
/** 行の border-b (1px) を含む実際の行の高さ */
const GANTT_ROW_HEIGHT = GANTT_ROW_CONTENT_HEIGHT + 1;
/** バーの top オフセット (tailwind top-1 = 4px) */
const GANTT_BAR_TOP = 4;
/** バー高さ */
const GANTT_BAR_HEIGHT = 16;
/** 行上端からバー縦中央までのオフセット */
const GANTT_BAR_CENTER_OFFSET = GANTT_BAR_TOP + GANTT_BAR_HEIGHT / 2;
/** sticky ヘッダーの border-b */
const GANTT_HEADER_BORDER = 1;
/** 左右スクロールでバーが枠外に出たときに残す末端の幅 (px) */
const GANTT_BAR_EDGE_TIP = 8;

function ganttPriorityClass(name: string): string {
  if (name === '今すぐ' || name === '急いで') return 'text-red-600';
  if (name === '高め') return 'text-orange-500';
  return 'text-gray-600';
}

function formatCompactDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatScheduleRange(startDate?: string | null, endDate?: string | null): string {
  const start = formatCompactDateTime(startDate);
  const end = formatCompactDateTime(endDate);
  if (!start && !end) return '';
  if (start && end) return `${start}～${end}`;
  if (start) return `${start}～`;
  return `～${end}`;
}

function formatHoursValue(hours: number | null | undefined): string {
  if (hours == null || hours === 0) return '';
  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : String(rounded);
}

/** 次がルート（depth 0）または末尾なら、ルートプロジェクト塊の区切り */
function isRootBlockEnd(nextDepth: number | null): boolean {
  return nextDepth === null || nextDepth === 0;
}

/**
 * 親子チケット間の行区切りか。
 * 親→子（深さ増加）、または親子ツリー内の行間（両方 depth>0）。
 */
function isParentChildTicketBorder(depth: number, nextDepth: number | null): boolean {
  if (nextDepth === null) return false;
  if (nextDepth > depth) return true;
  return depth > 0 && nextDepth > 0;
}

type RowBorderKind = 'root' | 'parentChild' | 'normal';

function rowBorderStyle(kind: RowBorderKind): { borderBottom: string } {
  switch (kind) {
    case 'root':
      return { borderBottom: '1px solid #64748B' };
    case 'parentChild':
      return { borderBottom: '1px dashed #E5E7EB' };
    default:
      return { borderBottom: '1px solid #E5E7EB' };
  }
}

/**
 * スクロール可視範囲に合わせてバー位置を調整する。
 * 枠外に完全に出たバーは、可視領域の端に末端の一部だけ残す（表示専用のヒント）。
 * 可視範囲と重なるバーはそのまま（スクロールの overflow で自然にクリップ）。
 */
function clampBarToScrollViewport(
  left: number,
  width: number,
  viewLeft: number,
  viewRight: number,
  tipPx: number = GANTT_BAR_EDGE_TIP,
): { left: number; width: number; edgeTip: 'left' | 'right' | null } {
  if (viewRight <= viewLeft) return { left, width, edgeTip: null };

  const right = left + width;
  const tip = Math.min(tipPx, width, viewRight - viewLeft);

  if (right <= viewLeft) {
    return { left: viewLeft, width: tip, edgeTip: 'left' };
  }
  if (left >= viewRight) {
    return { left: viewRight - tip, width: tip, edgeTip: 'right' };
  }

  return { left, width, edgeTip: null };
}

function ganttHeaderHeight(zoom: ZoomLevel): number {
  // 日: 30+24+24+24 / 月・年: 30+24  + sticky の border-b
  const content = zoom === 'day' ? 102 : 54;
  return content + GANTT_HEADER_BORDER;
}

/** ヘッダー内で日付表示行が始まる位置（年・月行を除いた上端オフセット） */
function ganttDateRowTop(zoom: ZoomLevel): number {
  // 日: 年(30)+月(24) を除いた日付・曜日行から / 月・年: 年(30) を除いた月行から
  return zoom === 'day' ? 54 : 30;
}

/** 関係線: S字・かぎ足の水平スタブ長 (px) */
const RELATION_LINE_STUB = 12;

/**
 * 先行バー右端中央 (x1,y1) → 後続バー左端中央 (x2,y2) を直交線で結ぶ。
 * - 隙間が十分: 隙間中央のかぎ足
 * - 終了と開始が同じ／近い: 行間を通る S 字
 */
function buildRelationLinePoints(x1: number, y1: number, x2: number, y2: number): string {
  const gap = x2 - x1;

  if (gap >= RELATION_LINE_STUB * 2) {
    const midX = x1 + gap / 2;
    return `${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  }

  // S字: 先行右へ出る → 行間で横切る → 後続左外側から中央へ入る
  const midY = (y1 + y2) / 2;
  const exitX = x1 + RELATION_LINE_STUB;
  const entryX = x2 - RELATION_LINE_STUB;
  return `${x1},${y1} ${exitX},${y1} ${exitX},${midY} ${entryX},${midY} ${entryX},${y2} ${x2},${y2}`;
}

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
// 非営業日（曜日休日・個別休日。個別出勤は営業扱い）はスキップする
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

  // 休日なら次の営業日の開始へ
  {
    const next = advanceToWorkingDay(current, settings);
    if (next.getTime() !== current.getTime()) {
      current.setTime(next.getTime());
      current.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
    }
  }

  // 1日の合計換算時間を超える場合、営業日数を加算
  if (totalDayConversion > 0 && remaining > totalDayConversion) {
    const daysToAdd = Math.floor((remaining - 1e-4) / totalDayConversion);
    const moved = addWorkingDays(current, daysToAdd, settings);
    current.setTime(moved.getTime());
    remaining -= daysToAdd * totalDayConversion;
  }

  let safety = 0;
  while (remaining > 1e-9 && safety++ < 1000) {
    {
      const next = advanceToWorkingDay(current, settings);
      if (next.getTime() !== current.getTime()) {
        current.setTime(next.getTime());
        current.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
      }
    }

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

  let result = new Date(date);
  result.setSeconds(0, 0);

  // 休日なら次の営業日の開始へ
  if (isNonWorkingDay(result, settings)) {
    result = advanceToWorkingDay(result, settings);
    result.setHours(Math.floor(workStart / 60), workStart % 60, 0, 0);
    return result;
  }

  const dateMin = result.getHours() * 60 + result.getMinutes();

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
    // 終了時刻以降 → 翌営業日の最初のスナップ点へ（ただし基本は当日内に収まるはず）
    result.setDate(result.getDate() + 1);
    const next = advanceToWorkingDay(result, settings);
    result.setTime(next.getTime());
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

/** ガント表示用の開始・終了日時（endDate 優先。未設定時は工数からの逆算にフォールバック） */
function resolveIssueSchedule(issue: Issue, settings?: SystemSetting): { start: Date; end: Date } | null {
  const s = issue.startDate ? new Date(issue.startDate) : null;
  const endRaw = issue.endDate ? new Date(issue.endDate) : null;
  const d = issue.dueDate ? new Date(issue.dueDate) : null;
  if (!s && !endRaw && !d) return null;

  if (s) {
    const start = snapToStartPoint(s, settings);
    let end: Date;
    if (endRaw) {
      end = snapToEndPoint(endRaw, settings);
    } else if (issue.estimatedHours) {
      end = snapToEndPoint(addConvertedHours(start, issue.estimatedHours, settings), settings);
    } else if (d) {
      end = snapToEndPoint(d, settings);
    } else {
      end = start;
    }
    return { start, end };
  }

  const end = endRaw ? snapToEndPoint(endRaw, settings) : snapToEndPoint(d!, settings);
  return { start: end, end };
}

function issueHasChildren(issue: Issue, allIssues: Issue[]): boolean {
  if ((issue._count?.children ?? 0) > 0) return true;
  return allIssues.some((i) => i.parentId === issue.id);
}

/** 親チケットは子のスケジュールを集約（表示上の子があればそちら優先、なければ API 集約値） */
function resolveIssueScheduleWithChildren(
  issue: Issue,
  allIssues: Issue[],
  settings?: SystemSetting,
  memo: Map<number, { start: Date; end: Date } | null> = new Map()
): { start: Date; end: Date } | null {
  if (memo.has(issue.id)) return memo.get(issue.id)!;
  const children = allIssues.filter((i) => i.parentId === issue.id);
  if (children.length === 0) {
    const result = resolveIssueSchedule(issue, settings);
    memo.set(issue.id, result);
    return result;
  }
  let minStart: Date | null = null;
  let maxEnd: Date | null = null;
  for (const child of children) {
    const schedule = resolveIssueScheduleWithChildren(child, allIssues, settings, memo);
    if (!schedule) continue;
    if (!minStart || schedule.start < minStart) minStart = schedule.start;
    if (!maxEnd || schedule.end > maxEnd) maxEnd = schedule.end;
  }
  const result = minStart || maxEnd ? { start: minStart || maxEnd!, end: maxEnd || minStart! } : null;
  memo.set(issue.id, result);
  return result;
}

function convertRangeOnZoomChange(
  fromZoom: ZoomLevel,
  toZoom: ZoomLevel,
  currentStart: string
): { start: string; end: string } | null {
  if (fromZoom === toZoom || !currentStart) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (year: number, month: number) =>
    new Date(year, month, 0).getDate();

  if (fromZoom === 'day') {
    // currentStart: YYYY-MM-DD
    const parts = currentStart.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]); // 1-based

    if (toZoom === 'month') {
      const endMonthRaw = month - 1 + 11; // 0-based + 11
      const endYear = year + Math.floor(endMonthRaw / 12);
      const endMonth = (endMonthRaw % 12) + 1;
      return {
        start: `${year}-${pad(month)}`,
        end: `${endYear}-${pad(endMonth)}`,
      };
    }
    if (toZoom === 'year') {
      return { start: `${year}`, end: `${year + 9}` };
    }
  }

  if (fromZoom === 'month') {
    // currentStart: YYYY-MM
    const parts = currentStart.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]); // 1-based

    if (toZoom === 'day') {
      const endMonthRaw = month - 1 + 5; // 0-based + 5
      const endYear = year + Math.floor(endMonthRaw / 12);
      const endMonth = (endMonthRaw % 12) + 1;
      return {
        start: `${year}-${pad(month)}-01`,
        end: `${endYear}-${pad(endMonth)}-${pad(lastDay(endYear, endMonth))}`,
      };
    }
    if (toZoom === 'year') {
      return { start: `${year}`, end: `${year + 9}` };
    }
  }

  if (fromZoom === 'year') {
    // currentStart: YYYY
    const year = parseInt(currentStart);

    if (toZoom === 'day') {
      return { start: `${year}-01-01`, end: `${year}-06-30` };
    }
    if (toZoom === 'month') {
      return { start: `${year}-01`, end: `${year}-06` };
    }
  }

  return null;
}

export default function GanttChart({
  issues, 
  projects = [], 
  showProject,
  showEmptyProjects = true,
  projectSort,
  issueSort,
  onUpdateIssue, 
  onIssueCreated, 
  onRelationCreated, 
  systemSettings,
  zoom: propsZoom = 'day',
  onZoomChange,
  startValue: propsStartValue = '',
  onStartValueChange,
  endValue: propsEndValue = '',
  onEndValueChange,
  filterTrackerIds: propsFilterTrackerIds = [],
  onFilterTrackerIdsChange,
  filterStatusIds: propsFilterStatusIds = [],
  onFilterStatusIdsChange,
  filterAssignedToIds: propsFilterAssignedToIds = [],
  onFilterAssignedToIdsChange,
  filterAssignedToGroupIds: propsFilterAssignedToGroupIds = [],
  filterAssignedToGroupMemberIds: propsFilterAssignedToGroupMemberIds = [],
  filterIncludeUnassigned = false,
  collapsedProjects: propsCollapsedProjects = new Set(),
  onCollapsedProjectsChange,
  issueFormPermissions,
}: GanttChartProps) {
  const { user, patchUser } = useAuth();
  const [resolvedFormPermissions, setResolvedFormPermissions] = useState<PermissionMap>(issueFormPermissions ?? {});
  const [permByProject, setPermByProject] = useState<Record<number, PermissionMap>>({});
  const { canInput: canInputResolved } = usePermissions(resolvedFormPermissions);
  const [columns, setColumns] = useState<GanttColumnConfig[]>(() =>
    normalizeGanttColumns(user?.uiPreferences?.gantt?.columns)
  );
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const saveColumnsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  useEffect(() => {
    setColumns(normalizeGanttColumns(user?.uiPreferences?.gantt?.columns));
  }, [user?.id]);

  const persistColumns = useCallback(
    (next: GanttColumnConfig[]) => {
      if (saveColumnsTimerRef.current) clearTimeout(saveColumnsTimerRef.current);
      saveColumnsTimerRef.current = setTimeout(() => {
        api
          .put('/auth/ui-preferences', { uiPreferences: { gantt: { columns: next } } })
          .then((res) => {
            if (res.data?.uiPreferences) {
              patchUser({ uiPreferences: res.data.uiPreferences });
            }
          })
          .catch((err) => console.error('Failed to save gantt columns:', err));
      }, 400);
    },
    [patchUser]
  );

  useEffect(() => {
    return () => {
      if (saveColumnsTimerRef.current) clearTimeout(saveColumnsTimerRef.current);
    };
  }, []);

  const applyColumns = useCallback(
    (next: GanttColumnConfig[]) => {
      const normalized = normalizeGanttColumns(next);
      setColumns(normalized);
      persistColumns(normalized);
    },
    [persistColumns]
  );

  const startResizeColumn = useCallback(
    (key: GanttColumnKey, e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const def = ganttColumnDef(key);
      const startX = e.clientX;
      const startWidth = columnsRef.current.find((c) => c.key === key)?.width ?? def.defaultWidth;
      const onMouseMove = (moveEvent: MouseEvent) => {
        const width = Math.max(
          def.minWidth,
          Math.min(def.maxWidth, Math.round(startWidth + (moveEvent.clientX - startX)))
        );
        setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, width } : c)));
      };
      const onMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        const width = Math.max(
          def.minWidth,
          Math.min(def.maxWidth, Math.round(startWidth + (upEvent.clientX - startX)))
        );
        const next = columnsRef.current.map((c) => (c.key === key ? { ...c, width } : c));
        setColumns(next);
        persistColumns(next);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [persistColumns]
  );

  const visibleColumns = useMemo(() => visibleGanttColumns(columns), [columns]);
  const leftColWidth = useMemo(() => Math.max(120, sumGanttColumnWidths(visibleColumns)), [visibleColumns]);

  useEffect(() => {
    if (issueFormPermissions) setResolvedFormPermissions(issueFormPermissions);
  }, [issueFormPermissions]);

  useEffect(() => {
    if (issueFormPermissions) return;
    const ids = [
      ...new Set([
        ...(projects?.map((p) => p.id) ?? []),
        ...issues.map((i) => i.projectId),
      ]),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    prefetchProjectPermissions(ids).then((maps) => {
      if (!cancelled) setPermByProject(maps);
    });
    return () => {
      cancelled = true;
    };
  }, [issues, projects, issueFormPermissions]);

  const canInputIssuesForProject = useCallback(
    (projectId: number) => {
      if (issueFormPermissions) return canInputResolved('projects.issues');
      return projectMapCanInput(permByProject[projectId], 'projects.issues');
    },
    [issueFormPermissions, canInputResolved, permByProject]
  );

  const loadFormPermissionsForProject = async (pid: number) => {
    if (issueFormPermissions) {
      setResolvedFormPermissions(issueFormPermissions);
      return;
    }
    try {
      const map = await getCachedProjectPermissions(pid);
      setResolvedFormPermissions(map);
      setPermByProject((prev) => ({ ...prev, [pid]: map }));
    } catch {
      setResolvedFormPermissions({});
    }
  };
  const [internalZoom, setInternalZoom] = useState<ZoomLevel>('day');
  const [internalStartValue, setInternalStartValue] = useState<string>('');
  const [internalEndValue, setInternalEndValue] = useState<string>('');

  const [internalFilterTrackerIds, setInternalFilterTrackerIds] = useState<(number | string)[]>([]);
  const [internalFilterAssignedToIds, setInternalFilterAssignedToIds] = useState<(number | string)[]>([]);
  const [internalFilterStatusIds, setInternalFilterStatusIds] = useState<(number | string)[]>([]);
  const [internalCollapsedProjects, setInternalCollapsedProjects] = useState<Set<number>>(new Set());
  
  // 外部propsを優先、なければ内部状態を使用
  const zoom = propsZoom ?? internalZoom;
  const setZoom = (z: ZoomLevel) => {
    setInternalZoom(z);
    onZoomChange?.(z);
    // ズーム変更時に期間を変換
    const newRange = convertRangeOnZoomChange(zoom, z, startValue);
    if (newRange) {
      setStartValue(newRange.start);
      setEndValue(newRange.end);
    }
  };
  
  const startValue = propsStartValue ?? internalStartValue;
  const setStartValue = (v: string) => {
    setInternalStartValue(v);
    onStartValueChange?.(v);
  };
  
  const endValue = propsEndValue ?? internalEndValue;
  const setEndValue = (v: string) => {
    setInternalEndValue(v);
    onEndValueChange?.(v);
  };
  
  const filterTrackerIds = propsFilterTrackerIds ?? internalFilterTrackerIds;
  const setFilterTrackerIds = (v: (number | string)[]) => {
    setInternalFilterTrackerIds(v);
    onFilterTrackerIdsChange?.(v);
  };
  
  const filterStatusIds = propsFilterStatusIds ?? internalFilterStatusIds;
  const setFilterStatusIds = (v: (number | string)[]) => {
    setInternalFilterStatusIds(v);
    onFilterStatusIdsChange?.(v);
  };
  
  const filterAssignedToIds = propsFilterAssignedToIds ?? internalFilterAssignedToIds;
  const setFilterAssignedToIds = (v: (number | string)[]) => {
    setInternalFilterAssignedToIds(v);
    onFilterAssignedToIdsChange?.(v);
  };
  const filterAssignedToGroupIds = propsFilterAssignedToGroupIds;
  const filterAssignedToGroupMemberIds = propsFilterAssignedToGroupMemberIds;

  const collapsedProjects = propsCollapsedProjects ?? internalCollapsedProjects;
  const setCollapsedProjects = (c: Set<number>) => {
    setInternalCollapsedProjects(c);
    onCollapsedProjectsChange?.(c);
  };

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

  type HeaderInfo = { label: string; days: number; dates: Date[]; year: number; month: number; isNewYear: boolean; isNewMonth: boolean; yearSpan: number; monthSpan: number };

  const chartRef = useRef<HTMLDivElement | null>(null);
  const dayWidth = ZOOM_CONFIG[zoom].dayWidth;
  /** タイムライン領域の横スクロール可視範囲（タイムライン座標） */
  const [scrollView, setScrollView] = useState({ left: 0, right: 0 });

  /** 本体の横スクロール位置（ヘッダーは transform で追従。scrollLeft 二重同期は使わない） */
  const syncScrollView = useCallback(() => {
    const el = chartRef.current;
    if (!el) return;
    const viewLeft = el.scrollLeft;
    const viewRight = el.scrollLeft + Math.max(0, el.clientWidth - leftColWidth);
    setScrollView((prev) =>
      prev.left === viewLeft && prev.right === viewRight ? prev : { left: viewLeft, right: viewRight }
    );
  }, [leftColWidth]);

  /**
   * チャート本体 DOM の mount 時に listener を付与する。
   * showProject=false では groupedIssues.length が常に 1 のため、
   * 空表示→チャート表示の切替で useEffect 依存が変わらず listener が付かないことがある。
   */
  const chartBodyCleanupRef = useRef<(() => void) | null>(null);
  const setChartBodyRef = useCallback(
    (el: HTMLDivElement | null) => {
      chartBodyCleanupRef.current?.();
      chartBodyCleanupRef.current = null;
      chartRef.current = el;
      if (!el) return;

      const onScroll = () => syncScrollView();
      el.addEventListener('scroll', onScroll, { passive: true });
      const ro = new ResizeObserver(() => syncScrollView());
      ro.observe(el);
      syncScrollView();
      chartBodyCleanupRef.current = () => {
        el.removeEventListener('scroll', onScroll);
        ro.disconnect();
      };
    },
    [syncScrollView],
  );

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
    initialStartDate: string;
    initialDueDate: string;
  }>({ isOpen: false, projectId: 0, initialStartDate: '', initialDueDate: '' });

  const [commentModal, setCommentModal] = useState<{ issue: Issue; comments: IssueComment[] } | null>(null);
  const [commentModalLoading, setCommentModalLoading] = useState(false);
  const [editIssueId, setEditIssueId] = useState<number | null>(null);
  const [detailIssueId, setDetailIssueId] = useState<number | null>(null);

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

  const toggleCollapse = useCallback((projectId: number) => {
    const next = new Set(collapsedProjects);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    setCollapsedProjects(next);
  }, [collapsedProjects, setCollapsedProjects]);

  // ズーム変更時の初期値設定（ユーザーが未設定の場合のみ）
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 値がない場合は初期値をセット
    if (!propsStartValue && !propsEndValue) {
      if (zoom === 'day') {
        setStartValue(formatDateToYYYYMMDD(new Date(currentYear, currentMonth, 1)));
        setEndValue(formatDateToYYYYMMDD(new Date(currentYear, currentMonth + 6, 0)));
      } else if (zoom === 'month') {
        const startMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const endMonth = currentMonth + 11;
        const endYear = currentYear + Math.floor(endMonth / 12);
        const endMonthNum = ((endMonth % 12) + 1);
        const endMonthStr = `${endYear}-${String(endMonthNum).padStart(2, '0')}`;
        setStartValue(startMonthStr);
        setEndValue(endMonthStr);
      } else if (zoom === 'year') {
        setStartValue(`${currentYear}`);
        setEndValue(`${currentYear + 9}`);
      }
      return;
    }

    // 値がある場合は、ズームレベルに合わせて変換
    const startStr = propsStartValue || '';
    const endStr = propsEndValue || '';

    // 現在のズームレベルを判定（値のフォーマットから）
    const getCurrentZoom = (value: string): 'day' | 'month' | 'year' | null => {
      if (!value) return null;
      const parts = value.split('-');
      if (parts.length === 3 && parts[0].length === 4) return 'day';
      if (parts.length === 2 && parts[0].length === 4) return 'month';
      if (parts.length === 1 && parts[0].length === 4) return 'year';
      return null;
    };

    const prevZoom = getCurrentZoom(startStr);

    // ズーム変換処理
    let newStart = startStr;
    let newEnd = endStr;

    if (prevZoom === 'day') {
      if (zoom === 'month') {
        // 日 → 月: YYYY-MM-DD → YYYY-MM
        newStart = startStr.slice(0, 7);
        newEnd = endStr.slice(0, 7);
      } else if (zoom === 'year') {
        // 日 → 年: YYYY-MM-DD → YYYY
        newStart = startStr.slice(0, 4);
        newEnd = endStr.slice(0, 4);
      }
    } else if (prevZoom === 'month') {
      if (zoom === 'day') {
        // 月 → 日: YYYY-MM → YYYY-MM-01 と YYYY-MM-末日
        const startDate = new Date(startStr + '-01');
        const endDate = new Date(endStr + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // 月の最後の日
        newStart = startDate.toISOString().slice(0, 10);
        newEnd = endDate.toISOString().slice(0, 10);
      } else if (zoom === 'year') {
        // 月 → 年: YYYY-MM → YYYY
        newStart = startStr.slice(0, 4);
        newEnd = endStr.slice(0, 4);
      }
    } else if (prevZoom === 'year') {
      if (zoom === 'day') {
        // 年 → 日: YYYY → YYYY-01-01 と YYYY-12-31
        const startYear = startStr;
        const endYear = endStr;
        newStart = `${startYear}-01-01`;
        newEnd = `${endYear}-12-31`;
      } else if (zoom === 'month') {
        // 年 → 月: YYYY → YYYY-01 と YYYY-12
        const startYear = startStr;
        const endYear = endStr;
        newStart = `${startYear}-01`;
        newEnd = `${endYear}-12`;
      }
    }

    setStartValue(newStart);
    setEndValue(newEnd);
  }, [zoom, propsStartValue, propsEndValue, setStartValue, setEndValue]);

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => {
      setTrackers(res.data.trackers);
      setStatuses(res.data.statuses);
      setAssignees(res.data.users);
    });
  }, []);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filterTrackerIds.length > 0 && !filterTrackerIds.some((id) => String(id) === String(issue.trackerId))) {
        return false;
      }
      const hasUserFilter = filterAssignedToIds.length > 0;
      const hasGroupFilter = filterAssignedToGroupIds != null && filterAssignedToGroupIds.length > 0;
      const hasGroupMemberFilter = filterAssignedToGroupMemberIds != null && filterAssignedToGroupMemberIds.length > 0;
      if (hasUserFilter || hasGroupFilter || hasGroupMemberFilter || filterIncludeUnassigned) {
        const userMatch =
          hasUserFilter &&
          issueHasAssigneeUser(issue, filterAssignedToIds);
        const groupMemberMatch =
          hasGroupMemberFilter &&
          issueHasAssigneeUser(issue, filterAssignedToGroupMemberIds!);
        const groupMatch =
          hasGroupFilter &&
          issue.assignedToGroupId != null &&
          filterAssignedToGroupIds!.some((id) => String(id) === String(issue.assignedToGroupId));
        const unassignedMatch = filterIncludeUnassigned && isIssueUnassigned(issue);
        if (!userMatch && !groupMemberMatch && !groupMatch && !unassignedMatch) return false;
      }
      if (filterStatusIds.length > 0 && !filterStatusIds.some((id) => String(id) === String(issue.statusId))) {
        return false;
      }
      return true;
    });
  }, [issues, filterTrackerIds, filterAssignedToIds, filterAssignedToGroupIds, filterAssignedToGroupMemberIds, filterIncludeUnassigned, filterStatusIds]);

  const trackerColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    trackers.forEach((t, i) => { map[t.id] = TRACKER_COLORS[i % TRACKER_COLORS.length]; });
    return map;
  }, [trackers]);

  const { chartStart, totalDays, months } = useMemo((): { chartStart: Date; totalDays: number; months: HeaderInfo[] } => {
    if (!startValue || !endValue) return { chartStart: new Date(), totalDays: 0, months: [] };

    let start: Date;
    let end: Date;

    if (zoom === 'year' && startValue.length === 4) {
      start = new Date(Number(startValue), 0, 1);
      end = new Date(Number(endValue), 11, 31);
    } else {
      const startParts = startValue.split('-').map(Number);
      const endParts = endValue.split('-').map(Number);
      
      if (startParts.length === 3) {
        start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      } else {
        start = new Date(startParts[0], startParts[1] - 1, 1);
      }
      
      if (endParts.length === 3) {
        end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      } else {
        end = new Date(endParts[0], endParts[1], 0);
      }
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
      return { left, width, edgeTip: null as 'left' | 'right' | null };
    }

    const schedule = resolveIssueScheduleWithChildren(issue, filteredIssues, systemSettings);
    if (!schedule) return null;
    const { start, end } = schedule;

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

    return clampBarToScrollViewport(visibleLeft, visibleWidth, scrollView.left, scrollView.right);
  }, [getOffset, dayWidth, drag, totalDays, systemSettings, filteredIssues, scrollView]);

  // グリッド線（year > month > week > day の太さで年月境界を一目で判別）
  type GridLineKind = 'year' | 'month' | 'week' | 'day';
  const gridLines = useMemo(() => {
    const lines: { offset: number; kind: GridLineKind }[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(chartStart, i);
      const isMonthStart = date.getDate() === 1;
      const isYearStart = isMonthStart && date.getMonth() === 0;
      if (zoom === 'day') {
        let kind: GridLineKind = 'day';
        if (isYearStart) kind = 'year';
        else if (isMonthStart) kind = 'month';
        else if (date.getDay() === 1) kind = 'week';
        lines.push({ offset: i * dayWidth, kind });
      } else if (zoom === 'month' && isMonthStart) {
        lines.push({ offset: i * dayWidth, kind: isYearStart ? 'year' : 'month' });
      } else if (zoom === 'year' && isMonthStart) {
        lines.push({ offset: i * dayWidth, kind: isYearStart ? 'year' : 'month' });
      }
    }
    return lines;
  }, [chartStart, totalDays, dayWidth, zoom]);

  const gridLineStyle = (kind: GridLineKind): { width: number; backgroundColor: string } => {
    switch (kind) {
      case 'year':
        return { width: 1, backgroundColor: '#64748B' }; // slate-500
      case 'month':
        return { width: 2, backgroundColor: '#94A3B8' }; // slate-400
      case 'week':
        return { width: 2, backgroundColor: '#CBD5E1' }; // slate-300
      default:
        return { width: 1, backgroundColor: '#E2E8F0' }; // slate-200
    }
  };

  // 日表示: 非営業日列の背景バンド
  const holidayBands = useMemo(() => {
    if (zoom !== 'day') return [] as { offset: number; width: number }[];
    const bands: { offset: number; width: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(chartStart, i);
      if (isNonWorkingDay(date, systemSettings)) {
        bands.push({ offset: i * dayWidth, width: dayWidth });
      }
    }
    return bands;
  }, [chartStart, totalDays, dayWidth, zoom, systemSettings]);

  // showProject時にプロジェクトごとにグループ化（ツリー表示対応）
  const { groupedIssues, issueDepthById } = useMemo(() => {
    const depthMap = new Map<number, number>();

    if (!showProject) {
      const ordered = orderIssuesHierarchically(filteredIssues, issueSort);
      ordered.forEach(({ issue, depth }) => depthMap.set(issue.id, depth));
      return {
        groupedIssues: [{
          projectName: '',
          companyName: null,
          projectId: 0,
          projectDueDate: null,
          issues: ordered.map((o) => o.issue),
          depth: 0,
          hasChildren: false,
        }],
        issueDepthById: depthMap,
      };
    }

    const groups: Record<number, { projectName: string; companyName: string | null; projectId: number; projectDueDate: string | null; issues: Issue[]; depth: number }> = {};

    projects.forEach((project) => {
      groups[project.id] = {
        projectName: project.name,
        companyName: project.company?.name ?? null,
        projectId: project.id,
        projectDueDate: project.dueDate || null,
        issues: [],
        depth: 0,
      };
    });

    filteredIssues.forEach((issue) => {
      const pid = issue.projectId;
      if (!groups[pid]) {
        groups[pid] = {
          projectName: issue.project?.name || `Project ${pid}`,
          companyName: null,
          projectId: pid,
          projectDueDate: null,
          issues: [],
          depth: 0,
        };
      }
      groups[pid].issues.push(issue);
    });

    if (!showEmptyProjects) {
      const idsWithIssues = new Set(
        Object.keys(groups)
          .map(Number)
          .filter((id) => groups[id].issues.length > 0),
      );
      const kept = filterProjectsKeepingAncestorsOfTicketed(
        projects.filter((p) => groups[p.id]),
        idsWithIssues,
      );
      const keepIds = new Set(kept.map((p) => p.id));
      idsWithIssues.forEach((id) => keepIds.add(id));
      Object.keys(groups).forEach((key) => {
        const id = Number(key);
        if (!keepIds.has(id)) delete groups[id];
      });
    }

    Object.values(groups).forEach((group) => {
      const ordered = orderIssuesHierarchically(group.issues, issueSort);
      group.issues = ordered.map((o) => o.issue);
      ordered.forEach(({ issue, depth }) => depthMap.set(issue.id, depth));
    });

    // Build parent -> children map
    const childrenMap: Record<number, number[]> = {};
    const projectIds = new Set(Object.keys(groups).map(Number));
    projects.forEach((project) => {
      const parentId = project.parentId;
      if (parentId && projectIds.has(parentId) && projectIds.has(project.id)) {
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(project.id);
      }
    });

    const projectById = new Map(projects.map((p) => [p.id, p]));

    const rootIds = sortSiblingProjects(
      projects.filter((p) => projectIds.has(p.id) && (!p.parentId || !projectIds.has(p.parentId))),
      projectSort,
    ).map((p) => p.id);

    // groups にだけ存在し projects に無い孤立 ID もルートとして扱う
    const rootIdSet = new Set(rootIds);
    Object.keys(groups).map(Number).forEach((id) => {
      if (!projects.some((p) => p.id === id) && !rootIdSet.has(id)) {
        rootIds.push(id);
        rootIdSet.add(id);
      }
    });

    const result: { projectName: string; companyName: string | null; projectId: number; projectDueDate: string | null; issues: Issue[]; depth: number; hasChildren: boolean }[] = [];
    const visited = new Set<number>();

    const sortChildIds = (ids: number[]) =>
      sortSiblingProjects(
        ids.map((id) => {
          const fromProjects = projectById.get(id);
          if (fromProjects) return fromProjects;
          const g = groups[id];
          return {
            id,
            name: g?.projectName ?? '',
            identifier: '',
            status: 'active',
            dueDate: g?.projectDueDate ?? null,
            company: g?.companyName ? { id: 0, name: g.companyName } : null,
            _count: { issues: g?.issues.length ?? 0 },
          } as Project;
        }),
        projectSort,
      ).map((p) => p.id);

    const traverse = (id: number, depth: number, ancestorCollapsed: boolean) => {
      if (visited.has(id)) return;
      visited.add(id);
      const group = groups[id];
      if (!group) return;
      group.depth = depth;
      const children = sortChildIds(childrenMap[id] || []);
      const hasChildren = children.length > 0 || group.issues.length > 0;
      if (!ancestorCollapsed) {
        result.push({ ...group, hasChildren });
      }
      const isCollapsed = collapsedProjects.has(id);
      children.forEach((childId) => traverse(childId, depth + 1, ancestorCollapsed || isCollapsed));
    };

    rootIds.forEach((id) => traverse(id, 0, false));

    Object.keys(groups).map(Number).forEach((id) => {
      if (!visited.has(id)) result.push({ ...groups[id], depth: 0, hasChildren: false });
    });

    return { groupedIssues: result, issueDepthById: depthMap };
  }, [filteredIssues, projects, showProject, showEmptyProjects, collapsedProjects, projectSort, issueSort]);

  // 各チケットの絶対位置を計算（線引き用）
  const issuePositions = useMemo(() => {
    const pos: Record<number, { left: number; width: number; top: number; edgeTip: 'left' | 'right' | null }> = {};
    let currentIndex = 0;

    groupedIssues.forEach((group) => {
      // プロジェクト行の分をカウント
      if (showProject) {
        currentIndex++;
      }

      group.issues.forEach((issue) => {
        const bar = getBarPosition(issue);
        if (bar) {
          pos[issue.id] = {
            left: bar.left,
            width: bar.width,
            edgeTip: bar.edgeTip,
            // バー縦方向の中央（本体コンテナ基準。ヘッダーは別要素）
            top: currentIndex * GANTT_ROW_HEIGHT + GANTT_BAR_CENTER_OFFSET,
          };
        }
        currentIndex++;
      });
    });
    return pos;
  }, [groupedIssues, getBarPosition, showProject]);

  // チケット期間からプロジェクトバーの位置を算出（グレー）
  const getProjectBarFromIssues = useCallback((groupIssues: Issue[]) => {
    let minStartOffset: number | null = null;
    let maxEndOffset: number | null = null;
    groupIssues.forEach((issue) => {
      const schedule = resolveIssueScheduleWithChildren(issue, filteredIssues, systemSettings);
      if (!schedule) return;
      const { start, end } = schedule;

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

    return clampBarToScrollViewport(visibleLeft, visibleWidth, scrollView.left, scrollView.right);
  }, [getOffset, dayWidth, totalDays, filteredIssues, systemSettings, scrollView]);

  // プロジェクト期限日バーの位置を算出（赤）
  const getProjectDueDateBar = useCallback((projectDueDate: string | null) => {
    if (!projectDueDate) return null;
    const dueDate = new Date(projectDueDate);
    const offset = getOffset(dueDate);

    if (offset < 0 || offset > totalDays) return null;

    // 期限日は1日分を覆う網掛けで表示
    return { left: offset * dayWidth };
  }, [getOffset, dayWidth, totalDays]);

  // ドラッグハンドラー
  const handleMouseDown = useCallback((e: React.MouseEvent, issue: Issue, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();
    if (!canInputIssuesForProject(issue.projectId)) return;
    if (issueHasChildren(issue, filteredIssues)) return;
    const schedule = resolveIssueScheduleWithChildren(issue, filteredIssues, systemSettings);
    if (!schedule) return;
    const { start, end } = schedule;

    setDrag({
      issueId: issue.id,
      type,
      startX: e.clientX,
      origStartDate: start,
      origDueDate: end,
      currentStartDate: start,
      currentDueDate: end,
    });
    setTooltip(null);
  }, [systemSettings, filteredIssues, canInputIssuesForProject]);

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
        newEnd = offsetToDate(newEndOffset, 'end');
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
        const data: { startDate?: string; endDate?: string } = {};
        if (drag.type === 'move' || drag.type === 'resize-left') {
          data.startDate = formatDateTime(drag.currentStartDate);
        }
        if (drag.type === 'move' || drag.type === 'resize-right' || drag.type === 'resize-left') {
          data.endDate = formatDateTime(drag.currentDueDate);
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


  const handleRelationMouseDown = useCallback((e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canInputIssuesForProject(issue.projectId)) return;
    setRelationDrag({
      fromIssue: issue,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      toIssueId: null,
    });
  }, [canInputIssuesForProject]);

  useEffect(() => {
    if (!relationDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (relationDrag) {
        document.body.classList.add('body-grabbing');
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
    };

    const handleMouseUp = async () => {
      // Immediately reset cursor and drag state to avoid persistent "move" cursor
      document.body.classList.remove('body-grabbing');
      const currentRelationDrag = relationDrag;
      setRelationDrag(null);

      if (currentRelationDrag) {
        if (currentRelationDrag.toIssueId && onRelationCreated) {
          await onRelationCreated(currentRelationDrag.fromIssue.id, currentRelationDrag.toIssueId);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [relationDrag, onRelationCreated, issues, onIssueCreated]);

  useEffect(() => {
    syncScrollView();
  }, [syncScrollView, totalDays, dayWidth]);

  const handleBarHover = useCallback((e: React.MouseEvent, issue: Issue) => {
    if (drag) return;
    setTooltip({ issue, x: e.clientX, y: e.clientY });
  }, [drag]);

  // プロジェクト行クリック時のハンドラー
  const handleProjectRowClick = useCallback((e: React.MouseEvent, projectId: number) => {
    if (!canInputIssuesForProject(projectId)) return;
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
    setAddModal({ isOpen: true, projectId, initialStartDate: dateStr, initialDueDate: '' });
    void loadFormPermissionsForProject(projectId);
  }, [chartStart, dayWidth, canInputIssuesForProject]);

  const columnResizeHandle = (key: GanttColumnKey) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-sky-400 z-30"
      onMouseDown={(e) => startResizeColumn(key, e)}
      title="幅を変更"
    />
  );

  const handleTicketClick = (e: React.MouseEvent, issueId: number) => {
    e.preventDefault();
    setDetailIssueId(issueId);
  };

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
        <div className="bg-white rounded-lg shadow relative max-w-full min-w-0">
          {/* ヘッダー部（ページ縦スクロールに追従して上部固定。横は本体 scrollLeft を transform で反映） */}
          <div className="sticky top-0 z-30 bg-white rounded-t-lg max-w-full" style={{ borderBottom: '1px solid #64748B' }}>
            <div className="flex relative min-w-0">
              <div
                style={{
                  width: leftColWidth,
                  height: ganttHeaderHeight(zoom) - GANTT_HEADER_BORDER,
                }}
                className="flex-shrink-0 bg-gray-50 border-r z-40 flex flex-col relative"
              >
                <div className="flex items-center gap-1 pt-1 px-2 flex-wrap">
                  {(['day', 'month', 'year'] as ZoomLevel[]).map((z) => (
                    <button
                      key={z}
                      onClick={() => setZoom(z)}
                      className={`px-3 py-0 text-xs leading-5 rounded border ${zoom === z ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                    >
                      {ZOOM_CONFIG[z].label}
                    </button>
                  ))}
                  {showProject && (
                    <>
                      <button
                        onClick={expandAll}
                        className="flex items-center gap-0.5 px-3 py-0 text-xs leading-5 rounded border bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
                      >
                        <UnfoldVertical size={11} />
                        展開
                      </button>
                      <button
                        onClick={collapseAll}
                        className="flex items-center gap-0.5 px-3 py-0 text-xs leading-5 rounded border bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
                      >
                        <FoldVertical size={11} />
                        折りたたむ
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setColumnSettingsOpen(true)}
                    className="flex items-center gap-0.5 px-3 py-0 text-xs leading-5 rounded border bg-white border-gray-300 hover:bg-gray-100 text-gray-600"
                    title="列の表示・順序"
                  >
                    <Columns3 size={11} />
                    列
                  </button>
                </div>
                <div className="mt-auto flex items-stretch border-t border-slate-200 text-[10px] font-medium text-slate-500 leading-tight">
                  {visibleColumns.map((col, colIndex) => (
                    <div
                      key={col.key}
                      style={{ width: col.width }}
                      className={`relative flex-shrink-0 px-1 py-0.5 flex items-center truncate ${colIndex > 0 ? 'border-l border-slate-200' : ''}`}
                      title={ganttColumnLabel(col.key)}
                    >
                      {ganttColumnLabel(col.key)}
                      {columnResizeHandle(col.key)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className="relative will-change-transform"
                  style={{
                    width: totalDays * dayWidth,
                    height: ganttHeaderHeight(zoom) - GANTT_HEADER_BORDER,
                    transform: `translate3d(-${scrollView.left}px, 0, 0)`,
                  }}
                >
                  {/* 1段目：年 */}
                  <div className="flex h-[30px] items-center border-b border-slate-300">
                    <div className="flex relative h-full items-center">
                      {months.map((m, i) => {
                        if (!m.isNewYear) return null;
                        return (
                          <div
                            key={`year-${i}`}
                            style={{ width: m.yearSpan * dayWidth, borderLeftWidth: 1, borderLeftColor: '#64748B' }}
                            className="relative h-full flex items-center border-l border-solid bg-slate-100"
                          >
                            <span style={{ position: 'sticky', left: 4 }} className="text-sm text-slate-700 font-semibold whitespace-nowrap px-1">
                              {m.year}年
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2段目：月 */}
                  <div className="flex h-6 items-center border-b border-slate-200">
                    <div className="flex relative h-full items-center">
                      {months.map((m, i) => {
                        if (!m.isNewMonth) return null;
                        return (
                          <div
                            key={`month-${i}`}
                            style={{
                              width: m.monthSpan * dayWidth,
                              borderLeftWidth: m.isNewYear ? 1 : 2,
                              borderLeftColor: m.isNewYear ? '#64748B' : '#94A3B8',
                            }}
                            className="relative h-full flex items-center border-l border-solid bg-slate-50"
                          >
                            <span style={{ position: 'sticky', left: 4 }} className="text-xs text-slate-600 font-semibold whitespace-nowrap px-1">
                              {m.month}月
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3段目：日（日表示のみ） */}
                  {zoom === 'day' && (
                    <div className="flex h-6 items-center border-b">
                      <div className="flex relative h-full items-center">
                        {months.map((m, i) => {
                          const nonWorking = isNonWorkingDay(m.dates[0], systemSettings);
                          return (
                            <div
                              key={`day-num-${i}`}
                              style={{
                                width: m.days * dayWidth,
                                borderLeftWidth: m.isNewYear ? 1 : m.isNewMonth ? 2 : 1,
                                borderLeftColor: m.isNewYear ? '#64748B' : m.isNewMonth ? '#94A3B8' : '#E2E8F0',
                              }}
                              className={`text-center text-[10px] h-full flex items-center justify-center border-l border-solid ${
                                nonWorking ? 'bg-red-50 text-red-500 font-medium' : 'bg-gray-50 text-gray-500'
                              }`}
                            >
                              {m.dates[0].getDate()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4段目：曜日（日表示のみ） */}
                  {zoom === 'day' && (
                    <div className="flex h-6 items-center">
                      <div className="flex relative h-full items-center">
                        {months.map((m, i) => {
                          const dayOfWeek = getDayOfWeekName(m.dates[0]);
                          const nonWorking = isNonWorkingDay(m.dates[0], systemSettings);
                          return (
                            <div
                              key={`day-week-${i}`}
                              style={{
                                width: m.days * dayWidth,
                                borderLeftWidth: m.isNewYear ? 1 : m.isNewMonth ? 2 : 1,
                                borderLeftColor: m.isNewYear ? '#64748B' : m.isNewMonth ? '#94A3B8' : '#E2E8F0',
                              }}
                              className={`text-center text-[10px] h-full flex items-center justify-center border-l border-solid font-medium ${
                                nonWorking ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-400'
                              }`}
                            >
                              {dayOfWeek}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 今日マーカー（ヘッダー側） */}
                  {todayOffset !== null && (
                    <>
                      <div
                        className="absolute bottom-0 pointer-events-none"
                        style={{
                          left: todayOffset,
                          width: dayWidth,
                          top: ganttDateRowTop(zoom),
                          border: '2px solid #3B82F6',
                          borderBottom: 'none',
                          borderRadius: '6px 6px 0 0',
                          boxSizing: 'border-box',
                          zIndex: 35,
                        }}
                      />
                      <div
                        className="absolute z-40 flex items-center justify-center"
                        style={{ left: todayOffset, top: 0, width: dayWidth, height: 30 }}
                      >
                        <span className="text-xs bg-blue-500 text-white px-1 rounded shadow-sm whitespace-nowrap">今日</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 本体（横スクロールのみ。縦はページ全体） */}
          <div className="overflow-x-auto relative" ref={setChartBodyRef}>
            <div className="relative" style={{ minWidth: totalDays * dayWidth + leftColWidth }}>
            {/* チケット行 */}
            {groupedIssues.map((group, groupIndex) => {
              const nextGroup = groupedIssues[groupIndex + 1];
              const nextProjectDepth = nextGroup ? nextGroup.depth : null;
              const ticketsVisible = !collapsedProjects.has(group.projectId) && group.issues.length > 0;

              return (
              <div key={group.projectId}>
                {showProject && (() => {
                  const projectIssuesBar = getProjectBarFromIssues(group.issues);
                  const projectDueDateBar = getProjectDueDateBar(group.projectDueDate);
                  const indentPx = group.depth * 16;
                  const isCollapsed = collapsedProjects.has(group.projectId);
                  // 塊の末尾は濃い実線。先頭上辺はヘッダー下線（同色・同太さ）で揃える
                  const projectRootEnd = !ticketsVisible && isRootBlockEnd(nextProjectDepth);
                  return (
                    <div
                      className="flex bg-slate-100 group"
                      style={{ height: GANTT_ROW_HEIGHT, boxSizing: 'border-box', ...rowBorderStyle(projectRootEnd ? 'root' : 'normal') }}
                    >
                      <div style={{ width: leftColWidth }} className="flex-shrink-0 text-xs font-semibold text-slate-700 border-r flex items-stretch sticky left-0 z-20 bg-slate-100 group-hover:bg-slate-200" title={group.companyName ? `${group.companyName} / ${group.projectName}` : group.projectName}>
                        {visibleColumns.map((col, colIndex) => (
                          <div
                            key={col.key}
                            style={{ width: col.width }}
                            className={`relative flex-shrink-0 truncate flex items-center ${colIndex > 0 ? 'border-l border-slate-300/60' : ''} ${col.key === 'ticket' ? 'py-0.5' : ''}`}
                          >
                            {col.key === 'ticket' ? (
                              <span style={{ paddingLeft: indentPx + 4 }} className="flex items-center gap-1 min-w-0 px-0.5">
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
                                <Link to={`/projects/${group.projectId}`} className="hover:text-sky-600 truncate">
                                  {group.companyName && <span className="text-slate-500 font-normal">{group.companyName} / </span>}
                                  {group.projectName}
                                </Link>
                              </span>
                            ) : null}
                            {columnResizeHandle(col.key)}
                          </div>
                        ))}
                      </div>
                      <div
                        className={`relative flex-1 transition-colors ${canInputIssuesForProject(group.projectId) ? 'cursor-pointer group-hover:bg-slate-200' : ''}`}
                        title={canInputIssuesForProject(group.projectId) ? 'クリックしてチケット追加' : undefined}
                        style={{ height: GANTT_ROW_CONTENT_HEIGHT }}
                        onClick={(e) => handleProjectRowClick(e, group.projectId)}
                      >
                        {holidayBands.map((band, i) => (
                          <div
                            key={`ph-${i}`}
                            className="absolute top-0 bottom-0 pointer-events-none bg-red-50/70"
                            style={{ left: band.offset, width: band.width }}
                          />
                        ))}
                        {/* グリッド線 */}
                        {gridLines.map((line, i) => (
                          <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{
                            left: line.offset,
                            ...gridLineStyle(line.kind),
                          }} />
                        ))}
                        {/* チケット期間バー */}
                        {projectIssuesBar && (
                          <div className="absolute rounded"
                            style={{
                              left: projectIssuesBar.left,
                              width: projectIssuesBar.width,
                              top: GANTT_BAR_TOP,
                              height: GANTT_BAR_HEIGHT,
                              backgroundColor: '#475569',
                              zIndex: 10,
                            }}
                          />
                        )}
                        {/* プロジェクト期限日マーカー（1日分を覆う赤い網掛け） */}
                        {projectDueDateBar && (
                          <div className="absolute top-0 bottom-0 cursor-help"
                            style={{
                              left: projectDueDateBar.left,
                              width: dayWidth,
                              backgroundImage:
                                'repeating-linear-gradient(45deg, rgba(220,38,38,0.8) 0, rgba(220,38,38,0.8) 3px, transparent 3px, transparent 6px)',
                              zIndex: 15,
                            }}
                            onMouseEnter={(e) => setTooltip({ projectDueDate: group.projectDueDate, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            onMouseMove={(e) => setTooltip({ projectDueDate: group.projectDueDate, x: e.clientX, y: e.clientY })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {!collapsedProjects.has(group.projectId) && group.issues.map((issue, issueIndex) => {
                  const bar = getBarPosition(issue);
                  const color = issue.status?.isClosed ? '#9CA3AF' : (trackerColorMap[issue.trackerId] || '#0EA5E9');
                  const isDragging = drag?.issueId === issue.id;
                  const isParent = issueHasChildren(issue, filteredIssues);
                  const issueDepth = issueDepthById.get(issue.id) ?? 0;
                  const isLastTicket = issueIndex === group.issues.length - 1;
                  const nextIssue = !isLastTicket ? group.issues[issueIndex + 1] : null;
                  const nextIssueDepth = nextIssue != null ? (issueDepthById.get(nextIssue.id) ?? 0) : null;
                  let ticketBorder: RowBorderKind = 'normal';
                  if (showProject && isLastTicket && isRootBlockEnd(nextProjectDepth)) {
                    ticketBorder = 'root';
                  } else if (isParentChildTicketBorder(issueDepth, nextIssueDepth)) {
                    ticketBorder = 'parentChild';
                  }

                  return (
                    <div
                      key={issue.id}
                      className="flex group hover:bg-gray-50 text-[11px]"
                      style={{ height: GANTT_ROW_HEIGHT, boxSizing: 'border-box', ...rowBorderStyle(ticketBorder) }}
                    >
                      <div style={{ width: leftColWidth }} className="flex-shrink-0 text-xs border-r flex items-stretch sticky left-0 z-20 bg-white group-hover:bg-gray-50" data-issue-id={issue.id}>
                        {(() => {
                          const assigneeLabel = formatIssueAssignees(issue);
                          const scheduleLabel = formatScheduleRange(issue.startDate, issue.endDate);
                          const estimatedLabel = formatHoursValue(issue.estimatedHours);
                          const actualLabel = formatHoursValue(issue.actualHours);
                          const totalDayConversion = (systemSettings?.conversionTimes || []).reduce((a: number, b: number) => a + b, 0);
                          const estimatedTitle = issue.estimatedHours
                            ? `予定工数: ${issue.estimatedHours}h${formatEstimatedHours(issue.estimatedHours, totalDayConversion) ? ` ${formatEstimatedHours(issue.estimatedHours, totalDayConversion)}` : ''}`
                            : undefined;
                          const actualTitle = issue.actualHours != null && issue.actualHours > 0
                            ? `実工数: ${formatHoursValue(issue.actualHours)}h（時間記録合計）`
                            : undefined;

                          const renderCell = (key: GanttColumnKey) => {
                            switch (key) {
                              case 'ticket':
                                return (
                                  <>
                                    {showProject && <span className="inline-block w-4 flex-shrink-0" />}
                                    <span className="inline-block flex-shrink-0" style={{ width: issueDepth * 12 }} />
                                    <span className="text-gray-400 mr-1 flex-shrink-0">#{issue.id}</span>
                                    {issue.tracker && (
                                      <span className="text-[10px] px-1 py-0 rounded mr-1 text-white flex-shrink-0" style={{ backgroundColor: trackerColorMap[issue.trackerId] || '#0EA5E9' }}>
                                        {issue.tracker.name}
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => handleTicketClick(e, issue.id)}
                                      className={`truncate text-left ${isParent ? 'font-semibold' : ''} ${
                                        issue.status?.isClosed
                                          ? 'line-through decoration-double decoration-slate-500 text-slate-500 hover:text-slate-600'
                                          : 'text-sky-600 hover:underline'
                                      }`}
                                    >
                                      {issue.subject}
                                    </button>
                                    {(issue._count?.comments ?? 0) > 0 && (
                                      <button
                                        className="ml-1 flex-shrink-0 text-gray-400 hover:text-sky-500"
                                        onClick={(e) => handleOpenCommentModal(e, issue)}
                                        title={`コメント ${issue._count!.comments}件`}
                                      >
                                        <MessageSquare size={13} />
                                      </button>
                                    )}
                                  </>
                                );
                              case 'priority':
                                return (
                                  <span className={`truncate font-medium ${ganttPriorityClass(issue.priority?.name || '')}`} title={issue.priority?.name}>
                                    {issue.priority?.name || ''}
                                  </span>
                                );
                              case 'assignee':
                                return (
                                  <span className="truncate text-gray-600" title={assigneeLabel || undefined}>
                                    {assigneeLabel}
                                  </span>
                                );
                              case 'status':
                                return issue.status?.name ? (
                                  <span
                                    className={`px-1 rounded text-[10px] font-medium truncate ${
                                      issue.status.isClosed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                                    }`}
                                    title={issue.status.name}
                                  >
                                    {issue.status.name}
                                  </span>
                                ) : null;
                              case 'schedule':
                                return (
                                  <span className="truncate text-gray-600 text-[10px]" title={scheduleLabel || undefined}>
                                    {scheduleLabel}
                                  </span>
                                );
                              case 'estimated':
                                return (
                                  <span className="truncate text-gray-600 tabular-nums w-full text-right" title={estimatedTitle}>
                                    {estimatedLabel}
                                  </span>
                                );
                              case 'actual':
                                return (
                                  <span className="truncate text-gray-600 tabular-nums w-full text-right" title={actualTitle}>
                                    {actualLabel}
                                  </span>
                                );
                              default:
                                return null;
                            }
                          };

                          return visibleColumns.map((col, colIndex) => (
                            <div
                              key={col.key}
                              style={{ width: col.width }}
                              className={`relative flex-shrink-0 px-1 flex items-center truncate ${colIndex > 0 ? 'border-l border-gray-100' : ''} ${
                                col.key === 'estimated' || col.key === 'actual' ? 'justify-end' : ''
                              }`}
                            >
                              {renderCell(col.key)}
                              {columnResizeHandle(col.key)}
                            </div>
                          ));
                        })()}
                      </div>
                      <div className={`relative flex-1 ${relationDrag?.toIssueId === issue.id ? 'bg-sky-50' : ''}`} style={{ height: GANTT_ROW_CONTENT_HEIGHT }} data-issue-id={issue.id}>
                        {holidayBands.map((band, i) => (
                          <div
                            key={`ih-${i}`}
                            className="absolute top-0 bottom-0 pointer-events-none bg-red-50/70"
                            style={{ left: band.offset, width: band.width }}
                          />
                        ))}
                        {/* グリッド線 */}
                        {gridLines.map((line, i) => (
                          <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{
                            left: line.offset,
                            ...gridLineStyle(line.kind),
                          }} />
                        ))}

                        {/* バー（枠外ヒントは表示専用・操作不可） */}
                        {bar && (
                          <div
                            className={`absolute rounded group ${isDragging ? 'opacity-80' : ''} ${isParent ? 'ring-1 ring-black/10' : ''} ${bar.edgeTip ? 'pointer-events-none' : ''}`}
                            style={{
                              left: bar.left,
                              width: bar.width,
                              top: GANTT_BAR_TOP,
                              height: GANTT_BAR_HEIGHT,
                              backgroundColor: isParent ? '#64748B' : color,
                              zIndex: 10,
                            }}
                            title={bar.edgeTip === 'left' ? '表示期間より前に設定' : bar.edgeTip === 'right' ? '表示期間より後に設定' : undefined}
                            onMouseEnter={bar.edgeTip ? undefined : (e) => handleBarHover(e, issue)}
                            onMouseLeave={bar.edgeTip ? undefined : () => !drag && setTooltip(null)}
                            onMouseMove={bar.edgeTip ? undefined : (e) => !drag && setTooltip({ issue, x: e.clientX, y: e.clientY })}
                          >
                            {!bar.edgeTip && (
                              <>
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
                                  {isParent ? (
                                    <div
                                      className="flex-1 h-full cursor-default"
                                      title="親チケットの期間は子チケットから算出（変更不可）"
                                    />
                                  ) : (
                                    <div
                                      className="flex-1 h-full cursor-grab active:cursor-grabbing"
                                      onMouseDown={(e) => handleMouseDown(e, issue, 'move')}
                                      title="ドラッグして移動（日付変更）"
                                    />
                                  )}
                                </div>

                                {/* ドラッグ: 左リサイズ */}
                                {!isParent && (
                                  <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize"
                                    onMouseDown={(e) => handleMouseDown(e, issue, 'resize-left')} />
                                )}

                                {/* ドラッグ: 右リサイズ */}
                                {!isParent && (
                                  <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
                                    onMouseDown={(e) => handleMouseDown(e, issue, 'resize-right')} />
                                )}

                                {/* ドラッグ日付プレビュー */}
                                {isDragging && drag && (
                                  <div className="absolute -top-5 left-0 text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap z-20">
                                    {formatDateDisplay(drag.currentStartDate)} 〜 {formatDateDisplay(drag.currentDueDate)}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* 期日マーカー（1日分を覆う黄色い網掛け） */}
                        {!isDragging && issue.dueDate && (() => {
                          const d = new Date(issue.dueDate);
                          d.setHours(0, 0, 0, 0);
                          const start = new Date(chartStart);
                          start.setHours(0, 0, 0, 0);
                          const left = Math.round((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                          if (left < 0 || left > totalDays) return null;
                          return (
                            <div
                              className="absolute top-0 bottom-0 z-[11] pointer-events-none"
                              style={{
                                left: left * dayWidth,
                                width: dayWidth,
                                backgroundImage:
                                  'repeating-linear-gradient(45deg, rgba(250,204,21,0.8) 0, rgba(250,204,21,0.8) 3px, transparent 3px, transparent 6px)',
                              }}
                              title={`期日: ${new Date(issue.dueDate).toLocaleDateString('ja-JP')}`}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })}

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
                  // 両方とも枠外ヒントのみのときは紐づけ線を出さない
                  if (fromPos.edgeTip && toPos.edgeTip) return null;

                  return (
                    <g key={`${issue.id}-${rel.issueToId}`}>
                      {(() => {
                        const isPredecessorFrom = ['precedes', 'blocks'].includes(rel.relationType);
                        const predPos = isPredecessorFrom ? fromPos : toPos;
                        const succPos = isPredecessorFrom ? toPos : fromPos;

                        // 始点: 先行チケットの終端 (右端) / 終点: 後行チケットの始端 (左端)
                        const x1 = predPos.left + predPos.width;
                        const y1 = predPos.top;
                        const x2 = succPos.left;
                        const y2 = succPos.top;

                        return (
                          <polyline
                            points={buildRelationLinePoints(x1, y1, x2, y2)}
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

            {/* 今日の列を囲む枠（本体側）。ヘッダー(z-30)・左列(z-20)より背面、バーより前面 */}
            {todayOffset !== null && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: todayOffset + leftColWidth,
                  width: dayWidth,
                  border: '2px solid #3B82F6',
                  borderTop: 'none',
                  borderRadius: '0 0 6px 6px',
                  boxSizing: 'border-box',
                  zIndex: 16,
                }}
              />
            )}
            </div>
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

      {/* 列設定モーダル */}
      <GanttColumnSettingsModal
        isOpen={columnSettingsOpen}
        onClose={() => setColumnSettingsOpen(false)}
        value={columns}
        onApply={applyColumns}
      />

      {/* チケット追加モーダル */}
      <IssueFormModal
        isOpen={addModal.isOpen}
        onClose={() => setAddModal({ ...addModal, isOpen: false })}
        title="新規チケット作成"
        projectId={String(addModal.projectId)}
        initialStartDate={addModal.initialStartDate}
        initialDueDate={addModal.initialDueDate}
        permissions={resolvedFormPermissions}
        onSuccess={() => {
          setAddModal({ ...addModal, isOpen: false });
          onIssueCreated?.();
        }}
        onCancel={() => setAddModal({ ...addModal, isOpen: false })}
      />

      {/* チケット詳細モーダル */}
      <Modal
        isOpen={detailIssueId !== null}
        onClose={() => setDetailIssueId(null)}
        title="チケット詳細"
        size="xl"
      >
        {(detailIssueId && user) && (
          <IssueDetail
            issueId={String(detailIssueId)}
            user={user}
            permissions={
              (() => {
                const issue = issues.find((i) => i.id === detailIssueId);
                if (!issue) return resolvedFormPermissions;
                if (issueFormPermissions) return issueFormPermissions;
                return permByProject[issue.projectId] ?? resolvedFormPermissions;
              })()
            }
            onEdit={
              (() => {
                const issue = issues.find((i) => i.id === detailIssueId);
                if (!issue || !canInputIssuesForProject(issue.projectId)) return undefined;
                return () => {
                  void loadFormPermissionsForProject(issue.projectId);
                  setEditIssueId(detailIssueId);
                  setDetailIssueId(null);
                };
              })()
            }
            onRefresh={() => {
              onIssueCreated?.();
            }}
          />
        )}
      </Modal>

      {/* チケット編集モーダル */}
      {editIssueId && (
        <IssueFormModal
          isOpen={editIssueId !== null}
          onClose={() => setEditIssueId(null)}
          title="チケットの編集"
          issueId={String(editIssueId)}
          permissions={resolvedFormPermissions}
          onSuccess={() => {
            setEditIssueId(null);
            onIssueCreated?.();
          }}
          onCancel={() => setEditIssueId(null)}
        />
      )}

      {/* ツールチップ */}
      {tooltip && !drag && (
        <div className="fixed z-50 bg-slate-800 text-white rounded-lg shadow-xl px-4 py-3 text-xs pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          {tooltip.issue ? (
            <>
              <div className="font-semibold mb-1">{tooltip.issue.subject}</div>
              <div className="space-y-0.5 text-slate-300">
                {tooltip.issue.tracker && <div>トラッカー: {tooltip.issue.tracker.name}</div>}
                {tooltip.issue.startDate && (
                  <div>
                    開始日時{issueHasChildren(tooltip.issue, filteredIssues) ? '（子から算出）' : ''}: {formatDateDisplay(new Date(tooltip.issue.startDate))}
                  </div>
                )}
                {(() => {
                  const schedule = resolveIssueScheduleWithChildren(tooltip.issue, filteredIssues, systemSettings);
                  return schedule ? (
                    <div>
                      終了日時{issueHasChildren(tooltip.issue, filteredIssues) ? '（子から算出）' : ''}: {formatDateDisplay(schedule.end)}
                    </div>
                  ) : null;
                })()}
                {tooltip.issue.dueDate && <div>期日: {new Date(tooltip.issue.dueDate).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>}
                {formatIssueAssignees(tooltip.issue) && (
                  <div>担当: {formatIssueAssignees(tooltip.issue)}</div>
                )}
                {tooltip.issue.priority && <div>優先度: {tooltip.issue.priority.name}</div>}
                {tooltip.issue.status && <div>ステータス: {tooltip.issue.status.name}</div>}
                {tooltip.issue.estimatedHours && (
                  <div>
                    予定工数: {tooltip.issue.estimatedHours}h
                    {systemSettings && (
                      <span className="ml-1 text-slate-400">
                        {formatEstimatedHours(tooltip.issue.estimatedHours, (systemSettings.conversionTimes || []).reduce((a: number, b: number) => a + b, 0))}
                      </span>
                    )}
                  </div>
                )}
                {tooltip.issue.actualHours != null && tooltip.issue.actualHours > 0 && (
                  <div>実工数: {formatHoursValue(tooltip.issue.actualHours)}h</div>
                )}
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
