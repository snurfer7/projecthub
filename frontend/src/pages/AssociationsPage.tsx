import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Association } from '../types';
import { Pencil, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import TextInput from '../components/TextInput';


export default function AssociationsPage() {
    const [associations, setAssociations] = useState<Association[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [prefecture, setPrefecture] = useState('');
    const [city, setCity] = useState('');
    const [street, setStreet] = useState('');
    const [building, setBuilding] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

    const loadAssociations = () => {
        api.get('/admin/associations').then((res) => setAssociations(res.data)).catch(console.error);
    };

    useEffect(() => { loadAssociations(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setName(''); setPostalCode(''); setPrefecture(''); setCity('');
        setStreet(''); setBuilding(''); setPhone(''); setWebsite(''); setNotes('');
        setError('');
        setShowModal(true);
    };

    const openEdit = (a: Association) => {
        setEditingId(a.id);
        setName(a.name);
        setPostalCode(a.postalCode || '');
        setPrefecture(a.prefecture || '');
        setCity(a.city || '');
        setStreet(a.street || '');
        setBuilding(a.building || '');
        setPhone(a.phone || '');
        setWebsite(a.website || '');
        setNotes(a.notes || '');
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
            const data = {
                name,
                postalCode: postalCode || null,
                prefecture: prefecture || null,
                city: city || null,
                street: street || null,
                building: building || null,
                phone: phone || null,
                website: website || null,
                notes: notes || null,
            };
            if (editingId) {
                await api.put(`/admin/associations/${editingId}`, data);
            } else {
                await api.post('/admin/associations', data);
            }
            closeModal();
            loadAssociations();
        } catch (err: any) {
            setError(err.response?.data?.error || (editingId ? '更新に失敗しました' : '作成に失敗しました'));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/admin/associations/${id}`);
            setConfirmDelete(null);
            loadAssociations();
        } catch (err: any) {
            alert(`削除に失敗しました: ${err.response?.data?.error || err.message}`);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800">協会</h1>
                <button
                    onClick={openCreate}
                    className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm"
                >
                    新規協会
                </button>
            </div>

            <div className="bg-white rounded-lg shadow">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">協会名</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">ウェブサイト</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                        </tr>
                    </thead>
                    <tbody>
                        {associations.map((a) => (
                            <tr key={a.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                                <td className="px-4 py-3 text-gray-600">
                                    {a.postalCode && `〒${a.postalCode} `}
                                    {a.prefecture}{a.city}{a.street}{a.building}
                                    {!a.postalCode && !a.prefecture && !a.city && !a.street && !a.building && '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{a.phone || '-'}</td>
                                <td className="px-4 py-3 text-gray-600">
                                    {a.website ? (
                                        <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                                            {a.website}
                                        </a>
                                    ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => openEdit(a)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setConfirmDelete({ id: a.id, name: a.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {associations.length === 0 && (
                    <div className="text-center py-8 text-gray-500">協会が登録されていません</div>
                )}
            </div>

            {showModal && (
                <Modal isOpen={showModal} title={editingId ? '協会を編集' : '新規協会'} onClose={closeModal}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
                        <TextInput
                            label="協会名"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <TextInput
                                label="郵便番号"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                placeholder="000-0000"
                            />
                            <TextInput
                                label="都道府県"
                                value={prefecture}
                                onChange={(e) => setPrefecture(e.target.value)}
                            />
                        </div>
                        <TextInput
                            label="市区町村"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                        />
                        <TextInput
                            label="番地"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                        />
                        <TextInput
                            label="建物名"
                            value={building}
                            onChange={(e) => setBuilding(e.target.value)}
                        />
                        <TextInput
                            label="電話番号"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                        <TextInput
                            label="ウェブサイト"
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://"
                        />
                        <TextInput
                            label="備考"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            isMultiline
                            rows={3}
                        />
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
                title="協会の削除"
                message={`協会「${confirmDelete?.name}」を削除しますか？この操作は取り消せません。`}
                onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                variant="danger"
            />
        </div>
    );
}
