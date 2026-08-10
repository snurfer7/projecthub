export type GanttColumnKey =
  | 'ticket'
  | 'priority'
  | 'assignee'
  | 'status'
  | 'dueDate'
  | 'schedule'
  | 'estimated'
  | 'actual';

export interface GanttColumnConfig {
  key: GanttColumnKey;
  visible: boolean;
  width: number;
}

export interface GanttColumnDef {
  key: GanttColumnKey;
  label: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** false のとき非表示にできない */
  hideable: boolean;
}

export const GANTT_COLUMN_DEFS: GanttColumnDef[] = [
  { key: 'ticket', label: 'チケット', defaultWidth: 220, minWidth: 120, maxWidth: 600, hideable: false },
  { key: 'priority', label: '優先度', defaultWidth: 56, minWidth: 40, maxWidth: 160, hideable: true },
  { key: 'assignee', label: '担当者', defaultWidth: 96, minWidth: 56, maxWidth: 240, hideable: true },
  { key: 'status', label: 'ステータス', defaultWidth: 80, minWidth: 56, maxWidth: 160, hideable: true },
  { key: 'dueDate', label: '期日', defaultWidth: 80, minWidth: 56, maxWidth: 160, hideable: true },
  { key: 'schedule', label: '開始～終了', defaultWidth: 168, minWidth: 100, maxWidth: 320, hideable: true },
  { key: 'estimated', label: '予定工数', defaultWidth: 56, minWidth: 40, maxWidth: 120, hideable: true },
  { key: 'actual', label: '実工数', defaultWidth: 52, minWidth: 40, maxWidth: 120, hideable: true },
];

const DEF_BY_KEY = Object.fromEntries(GANTT_COLUMN_DEFS.map((d) => [d.key, d])) as Record<
  GanttColumnKey,
  GanttColumnDef
>;

export const ALL_GANTT_COLUMN_KEYS = GANTT_COLUMN_DEFS.map((d) => d.key);

export function defaultGanttColumns(): GanttColumnConfig[] {
  return GANTT_COLUMN_DEFS.map((d) => ({
    key: d.key,
    visible: true,
    width: d.defaultWidth,
  }));
}

export function ganttColumnLabel(key: GanttColumnKey): string {
  return DEF_BY_KEY[key]?.label ?? key;
}

export function ganttColumnDef(key: GanttColumnKey): GanttColumnDef {
  return DEF_BY_KEY[key];
}

function clampWidth(key: GanttColumnKey, width: number): number {
  const def = DEF_BY_KEY[key];
  if (!def) return width;
  const n = Number.isFinite(width) ? Math.round(width) : def.defaultWidth;
  return Math.max(def.minWidth, Math.min(def.maxWidth, n));
}

/** API / 保存値を正規化（未知キー除外・不足キー補完・ticket は常に表示） */
export function normalizeGanttColumns(raw: unknown): GanttColumnConfig[] {
  const defaults = defaultGanttColumns();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const seen = new Set<GanttColumnKey>();
  const ordered: GanttColumnConfig[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = (item as { key?: unknown }).key;
    if (typeof key !== 'string' || !(key in DEF_BY_KEY)) continue;
    const colKey = key as GanttColumnKey;
    if (seen.has(colKey)) continue;
    seen.add(colKey);
    const def = DEF_BY_KEY[colKey];
    const visibleRaw = (item as { visible?: unknown }).visible;
    const widthRaw = (item as { width?: unknown }).width;
    ordered.push({
      key: colKey,
      visible: def.hideable === false ? true : visibleRaw !== false,
      width: clampWidth(colKey, typeof widthRaw === 'number' ? widthRaw : def.defaultWidth),
    });
  }

  for (const d of defaults) {
    if (!seen.has(d.key)) ordered.push(d);
  }

  return ordered;
}

export function visibleGanttColumns(columns: GanttColumnConfig[]): GanttColumnConfig[] {
  return columns.filter((c) => c.visible);
}

export function sumGanttColumnWidths(columns: GanttColumnConfig[]): number {
  return columns.reduce((sum, c) => sum + c.width, 0);
}
