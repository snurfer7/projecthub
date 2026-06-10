/** クエリの数値 ID（単一・カンマ区切り・配列）を正規化する */
export function parseNumericQueryIds(value: unknown): number[] {
  if (value == null || value === '') return [];
  const parts = Array.isArray(value) ? value : String(value).split(',');
  const ids: number[] = [];
  for (const part of parts) {
    const n = Number(String(part).trim());
    if (!Number.isNaN(n)) ids.push(n);
  }
  return [...new Set(ids)];
}
