import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { LegalEntityStatus } from '../types';
import { Pencil, Trash2, GripVertical } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';

export default function LegalEntityStatusesPage() {
    const [statuses, setStatuses] = useState<LegalEntityStatus[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

    const loadStatuses = () => {
        api.get('/admin/legal-entity-statuses').then((res) => setStatuses(res.data)).catch(console.error);
    };

    useEffect(() => { loadStatuses(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setName('');
        setError('');
        setShowModal(true);
    };

    const openEdit = (s: LegalEntityStatus) => {
        setEditingId(s.id);
        setName(s.name);
        setError('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setError('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const data = { name };
            if (editingId) {
                await api.put(`/admin/legal-entity-statuses/${editingId}`, data);
            } else {
                await api.post('/admin/legal-entity-statuses', data);
            }
            closeModal();
            loadStatuses();
        } catch (err: any) {
            setError(err.response?.data?.error || (editingId ? '更新に失敗しました' : '作成に失敗しました'));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/admin/legal-entity-statuses/${id}`);
            setConfirmDelete(null);
            loadStatuses();
        } catch (err: any) {
            alert(`削除に失敗しました: ${err.response?.data?.error || err.message}`);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800">法人格</h1>
                <button
                    onClick={openCreate}
                    className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm"
                >
                    新規法人格
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-10 px-4 py-3"></th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">法人格名</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                        </tr>
                    </thead>
                    <tbody>
                        {statuses.map((s) => (
                            <tr key={s.id} className="border-t hover:bg-gray-50 group">
                                <td className="px-4 py-3 text-gray-400">
                                    <GripVertical size={16} className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => openEdit(s)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setConfirmDelete({ id: s.id, name: s.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {statuses.length === 0 && (
                    <div className="text-center py-8 text-gray-500">法人格が登録されていません</div>
                )}
            </div>

            {showModal && (
                <Modal isOpen={showModal} title={editingId ? '法人格を編集' : '新規法人格'} onClose={closeModal}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">法人格名 *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                placeholder="例: 株式会社"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                                キャンセル
                            </button>
                            <button type="submit" className="px-4 py-2 text-sm text-white bg-sky-600 rounded-md hover:bg-sky-700">
                                {editingId ? '更新' : '作成'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmationModal
                isOpen={!!confirmDelete}
                title="法人格の削除"
                message={`法人格「${confirmDelete?.name}」を削除しますか？この操作は取り消せません。`}
                onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                variant="danger"
            />
        </div>
    );
}
