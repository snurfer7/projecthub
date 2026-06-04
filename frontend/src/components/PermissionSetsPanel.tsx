import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/client';
import { Group, PermissionResource, PermissionSet } from '../types';
import { Pencil, Trash2, Plus } from 'lucide-react';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import TextInput from './TextInput';

interface PermissionRow {
  resourceId: number;
  code: string;
  name: string;
  depth: number;
  canUse: boolean;
  canInput: boolean;
}

function flattenResources(
  nodes: PermissionResource[],
  depth = 0,
  existing: Map<number, { canUse: boolean; canInput: boolean }> = new Map()
): PermissionRow[] {
  const rows: PermissionRow[] = [];
  for (const node of nodes) {
    const perm = existing.get(node.id) ?? { canUse: false, canInput: false };
    rows.push({
      resourceId: node.id,
      code: node.code,
      name: node.name,
      depth,
      canUse: perm.canUse,
      canInput: perm.canInput,
    });
    if (node.children?.length) {
      rows.push(...flattenResources(node.children, depth + 1, existing));
    }
  }
  return rows;
}

export default function PermissionSetsPanel() {
  const { refreshUser } = useAuth();
  const [sets, setSets] = useState<PermissionSet[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<PermissionResource[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<PermissionSet | null>(null);

  const load = () => {
    api.get('/admin/permission-sets').then((res) => setSets(res.data)).catch(console.error);
    api.get('/admin/groups').then((res) => setGroups(res.data)).catch(console.error);
    api.get('/admin/permissions/resources').then((res) => setCatalog(res.data)).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setGroupIds([]);
    setRows(flattenResources(catalog));
    setError('');
    setShowModal(true);
  };

  const openEdit = async (set: PermissionSet) => {
    const res = await api.get(`/admin/permission-sets/${set.id}`);
    const detail: PermissionSet = res.data;
    const existing = new Map(
      (detail.permissions ?? []).map((p) => [p.resourceId, { canUse: p.canUse, canInput: p.canInput }])
    );
    setEditingId(set.id);
    setName(detail.name);
    setDescription(detail.description ?? '');
    setGroupIds(detail.groups?.map((g) => g.id) ?? []);
    setRows(flattenResources(catalog, 0, existing));
    setError('');
    setShowModal(true);
  };

  const toggleGroup = (id: number) => {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const parentCodesOf = (code: string): string[] => {
    const parts = code.split('.');
    const parents: string[] = [];
    for (let i = parts.length - 1; i > 0; i--) {
      parents.push(parts.slice(0, i).join('.'));
    }
    return parents;
  };

  const updateRow = (resourceId: number, field: 'canUse' | 'canInput', value: boolean) => {
    setRows((prev) => {
      const target = prev.find((r) => r.resourceId === resourceId);
      if (!target) return prev;
      const parentCodeSet = new Set(parentCodesOf(target.code));
      return prev.map((row) => {
        let next = { ...row };
        if (row.resourceId === resourceId) {
          if (field === 'canUse') {
            next = { ...next, canUse: value, canInput: value ? next.canInput : false };
          } else {
            next = { ...next, canInput: value, canUse: value ? true : next.canUse };
          }
        } else if (value && parentCodeSet.has(row.code)) {
          if (field === 'canUse' || field === 'canInput') {
            next.canUse = true;
          }
        }
        return next;
      });
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      description,
      groupIds,
      permissions: rows.map((r) => ({
        resourceId: r.resourceId,
        canUse: r.canUse,
        canInput: r.canInput,
      })),
    };
    try {
      if (editingId) {
        await api.put(`/admin/permission-sets/${editingId}`, payload);
      } else {
        await api.post('/admin/permission-sets', payload);
      }
      setShowModal(false);
      load();
      refreshUser().catch(console.error);
    } catch (err: any) {
      setError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.delete(`/admin/permission-sets/${confirmDelete.id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">権限設定</h2>
        <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          <Plus size={16} /> 新規作成
        </button>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">名前</th>
            <th className="p-2 border">説明</th>
            <th className="p-2 border">割当グループ</th>
            <th className="p-2 border w-24">操作</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="p-2 border">{s.name}</td>
              <td className="p-2 border text-gray-600">{s.description || '-'}</td>
              <td className="p-2 border">
                {s.groups?.map((g) => g.name).join(', ') || '-'}
                {!s.groups?.length && s._count?.groups ? `${s._count.groups} 件` : ''}
              </td>
              <td className="p-2 border">
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800"><Pencil size={16} /></button>
                  <button onClick={() => setConfirmDelete(s)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
          {sets.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-gray-500 border">権限設定がありません</td></tr>
          )}
        </tbody>
      </table>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? '権限設定を編集' : '権限設定を作成'}
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">キャンセル</button>
            <button type="submit" form="permission-set-form" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
          </>
        }
      >
        <form id="permission-set-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <TextInput label="名前 *" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextInput label="説明" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div>
            <div className="text-sm font-medium mb-2">グループ割当（複数選択可）</div>
            <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  {g.name}
                  {g.permissionSet && g.permissionSetId !== editingId && (
                    <span className="text-xs text-amber-600">（現在: {g.permissionSet.name}）</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">権限マトリクス</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-1 border text-left">項目</th>
                  <th className="p-1 border w-16">使用</th>
                  <th className="p-1 border w-16">入力</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.resourceId}>
                    <td className="p-1 border" style={{ paddingLeft: `${8 + row.depth * 16}px` }}>{row.name}</td>
                    <td className="p-1 border text-center">
                      <input type="checkbox" checked={row.canUse} onChange={(e) => updateRow(row.resourceId, 'canUse', e.target.checked)} />
                    </td>
                    <td className="p-1 border text-center">
                      <input type="checkbox" checked={row.canInput} onChange={(e) => updateRow(row.resourceId, 'canInput', e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="権限設定の削除"
        message={`「${confirmDelete?.name}」を削除しますか？割当グループの権限設定は解除されます。`}
      />
    </div>
  );
}
