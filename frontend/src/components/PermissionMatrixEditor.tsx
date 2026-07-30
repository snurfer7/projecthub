import { PermissionResource } from '../types';

export interface PermissionMatrixRow {
  resourceId: number;
  code: string;
  name: string;
  depth: number;
  canUse: boolean;
  canInput: boolean;
  /** group-scoped parent shown as heading only (not saved) */
  readOnly?: boolean;
}

export function flattenPermissionResources(
  nodes: PermissionResource[],
  depth = 0,
  existing: Map<number, { canUse: boolean; canInput: boolean }> = new Map()
): PermissionMatrixRow[] {
  const rows: PermissionMatrixRow[] = [];
  for (const node of nodes) {
    const isGroupParent = node.scope === 'group';
    const perm = existing.get(node.id) ?? { canUse: false, canInput: false };
    rows.push({
      resourceId: node.id,
      code: node.code,
      name: node.name,
      depth,
      canUse: perm.canUse,
      canInput: perm.canInput,
      readOnly: isGroupParent,
    });
    if (node.children?.length) {
      rows.push(...flattenPermissionResources(node.children, depth + 1, existing));
    }
  }
  return rows;
}

function descendantResourceIds(rows: PermissionMatrixRow[], index: number): number[] {
  const depth = rows[index].depth;
  const ids: number[] = [];
  for (let i = index + 1; i < rows.length; i++) {
    if (rows[i].depth <= depth) break;
    if (!rows[i].readOnly) ids.push(rows[i].resourceId);
  }
  return ids;
}

interface Props {
  rows: PermissionMatrixRow[];
  onChange: (rows: PermissionMatrixRow[]) => void;
}

export default function PermissionMatrixEditor({ rows, onChange }: Props) {
  const updateRow = (resourceId: number, patch: Partial<PermissionMatrixRow>) => {
    const index = rows.findIndex((r) => r.resourceId === resourceId);
    if (index < 0 || rows[index].readOnly) return;
    const descendantIds = new Set(descendantResourceIds(rows, index));
    onChange(
      rows.map((r, i) => {
        if (r.readOnly) return r;
        if (i === index) {
          const next = { ...r, ...patch };
          if (patch.canUse === false) next.canInput = false;
          if (patch.canInput === true) next.canUse = true;
          return next;
        }
        if (!descendantIds.has(r.resourceId)) return r;
        // Parent use/input off → clear descendants the same way
        if (patch.canUse === false) return { ...r, canUse: false, canInput: false };
        if (patch.canInput === false) return { ...r, canInput: false };
        return r;
      })
    );
  };

  const toggleSubtree = (index: number) => {
    const row = rows[index];
    if (row.readOnly) return;
    const turnOn = !(row.canUse && row.canInput);
    const descendantIds = new Set(descendantResourceIds(rows, index));
    onChange(
      rows.map((r, i) => {
        if (r.readOnly) return r;
        if (i === index || descendantIds.has(r.resourceId)) {
          return { ...r, canUse: turnOn, canInput: turnOn };
        }
        // enable parent canUse when turning on
        if (turnOn && r.depth < row.depth && i < index) {
          let isAncestor = true;
          for (let j = i + 1; j < index; j++) {
            if (rows[j].depth <= r.depth) {
              isAncestor = false;
              break;
            }
          }
          if (isAncestor) return { ...r, canUse: true };
        }
        return r;
      })
    );
  };

  return (
    <div className="border rounded-md overflow-hidden max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-gray-600">機能・項目</th>
            <th className="w-16 text-center px-2 py-2 font-medium text-gray-600">使用</th>
            <th className="w-16 text-center px-2 py-2 font-medium text-gray-600">入力</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => (
            <tr key={row.resourceId} className={row.readOnly ? 'bg-gray-50' : 'hover:bg-sky-50/40'}>
              <td className="px-3 py-1.5">
                <button
                  type="button"
                  className={`text-left w-full ${row.readOnly ? 'font-semibold text-gray-700 cursor-default' : 'hover:text-sky-700'}`}
                  style={{ paddingLeft: row.depth * 12 }}
                  onClick={() => !row.readOnly && toggleSubtree(index)}
                  disabled={row.readOnly}
                >
                  {row.name}
                </button>
              </td>
              <td className="text-center px-2">
                {!row.readOnly && (
                  <input
                    type="checkbox"
                    checked={row.canUse}
                    onChange={(e) => updateRow(row.resourceId, { canUse: e.target.checked })}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                )}
              </td>
              <td className="text-center px-2">
                {!row.readOnly && (
                  <input
                    type="checkbox"
                    checked={row.canInput}
                    onChange={(e) => updateRow(row.resourceId, { canInput: e.target.checked })}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
