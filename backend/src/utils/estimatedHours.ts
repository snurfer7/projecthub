/** 予定工数が不正なときのエラーメッセージ。未指定・空・null は妥当。 */
export function estimatedHoursError(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return '予定工数は0以上の数値で入力してください';
  }
  const normalized = Math.round(n * 2) / 2;
  if (Math.abs(n - normalized) > 1e-9) {
    return '予定工数は0.5刻みで入力してください';
  }
  return null;
}

/**
 * 予定工数を保存用に正規化（0.5 刻み）。
 * 空・null・0 は null。呼び出し前に estimatedHoursError で検証すること。
 */
export function normalizeEstimatedHours(value: unknown): number | null {
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  const normalized = Math.round(n * 2) / 2;
  return normalized === 0 ? null : normalized;
}
