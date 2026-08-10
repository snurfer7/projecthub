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

const COLUMN_KEYS: GanttColumnKey[] = [
  'ticket',
  'priority',
  'assignee',
  'status',
  'dueDate',
  'schedule',
  'estimated',
  'actual',
];

const KEY_SET = new Set<string>(COLUMN_KEYS);

const BOUNDS: Record<GanttColumnKey, { min: number; max: number; defaultWidth: number; hideable: boolean }> = {
  ticket: { min: 120, max: 600, defaultWidth: 220, hideable: false },
  priority: { min: 40, max: 160, defaultWidth: 56, hideable: true },
  assignee: { min: 56, max: 240, defaultWidth: 96, hideable: true },
  status: { min: 56, max: 160, defaultWidth: 80, hideable: true },
  dueDate: { min: 56, max: 160, defaultWidth: 80, hideable: true },
  schedule: { min: 100, max: 320, defaultWidth: 168, hideable: true },
  estimated: { min: 40, max: 120, defaultWidth: 56, hideable: true },
  actual: { min: 40, max: 120, defaultWidth: 52, hideable: true },
};

export function defaultGanttColumns(): GanttColumnConfig[] {
  return COLUMN_KEYS.map((key) => ({
    key,
    visible: true,
    width: BOUNDS[key].defaultWidth,
  }));
}

export function normalizeGanttColumns(raw: unknown): GanttColumnConfig[] {
  const defaults = defaultGanttColumns();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const seen = new Set<GanttColumnKey>();
  const ordered: GanttColumnConfig[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = (item as { key?: unknown }).key;
    if (typeof key !== 'string' || !KEY_SET.has(key)) continue;
    const colKey = key as GanttColumnKey;
    if (seen.has(colKey)) continue;
    seen.add(colKey);
    const bounds = BOUNDS[colKey];
    const visibleRaw = (item as { visible?: unknown }).visible;
    const widthRaw = (item as { width?: unknown }).width;
    const width =
      typeof widthRaw === 'number' && Number.isFinite(widthRaw)
        ? Math.max(bounds.min, Math.min(bounds.max, Math.round(widthRaw)))
        : bounds.defaultWidth;
    ordered.push({
      key: colKey,
      visible: bounds.hideable === false ? true : visibleRaw !== false,
      width,
    });
  }

  for (const d of defaults) {
    if (!seen.has(d.key)) ordered.push(d);
  }

  return ordered;
}

export type UserUiPreferences = {
  gantt?: {
    columns?: GanttColumnConfig[];
  };
};

export function parseUiPreferences(raw: unknown): UserUiPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const ganttRaw = obj.gantt;
  if (!ganttRaw || typeof ganttRaw !== 'object' || Array.isArray(ganttRaw)) {
    return {};
  }
  const columnsRaw = (ganttRaw as { columns?: unknown }).columns;
  return {
    gantt: {
      columns: normalizeGanttColumns(columnsRaw),
    },
  };
}

/** Deep-merge uiPreferences; gantt.columns は正規化して置換 */
export function mergeUiPreferences(current: unknown, patch: unknown): UserUiPreferences {
  const base = parseUiPreferences(current);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return base;
  }
  const patchObj = patch as Record<string, unknown>;
  const next: UserUiPreferences = { ...base };

  if (patchObj.gantt != null && typeof patchObj.gantt === 'object' && !Array.isArray(patchObj.gantt)) {
    const ganttPatch = patchObj.gantt as { columns?: unknown };
    next.gantt = {
      ...(base.gantt ?? {}),
      ...(ganttPatch.columns !== undefined
        ? { columns: normalizeGanttColumns(ganttPatch.columns) }
        : {}),
    };
  }

  return next;
}
