import { useState, useEffect } from 'react';
import api from '../api/client';
import { Location } from '../types';
import { Pencil, Trash2, MapPin, Phone } from 'lucide-react';
import LocationModal from './LocationModal';
import ConfirmationModal from './ConfirmationModal';


interface CompanyLocationsTabProps {
    companyId: number;
    onUpdateCount: () => void;
}

export default function CompanyLocationsTab({ companyId, onUpdateCount }: CompanyLocationsTabProps) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);


    const loadLocations = async () => {
        try {
            const res = await api.get(`/companies/${companyId}/locations`);
            setLocations(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load locations:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocations();
    }, [companyId]);

    const handleCreate = () => {
        setEditingLocation(null);
        setError('');
        setShowModal(true);
    };

    const handleEdit = (location: Location) => {
        setEditingLocation(location);
        setError('');
        setShowModal(true);
    };

    const handleDelete = async (locationId: number) => {
        try {
            await api.delete(`/companies/${companyId}/locations/${locationId}`);
            setConfirmDelete(null);
            loadLocations();
            onUpdateCount();
        } catch (err: any) {
            alert(err.response?.data?.error || '削除に失敗しました');
        }
    };

    const handleSubmit = async (data: any) => {
        try {
            if (editingLocation) {
                await api.put(`/companies/${companyId}/locations/${editingLocation.id}`, data);
            } else {
                await api.post(`/companies/${companyId}/locations`, data);
            }
            setShowModal(false);
            loadLocations();
            onUpdateCount();
        } catch (err: any) {
            setError(err.response?.data?.error || '保存に失敗しました');
        }
    };

    if (loading) return <div className="text-center py-8 text-gray-500">読み込み中...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-700">拠点</h2>
                <button
                    onClick={handleCreate}
                    className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm transition-colors"
                >
                    新規拠点
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">拠点名</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">郵便番号</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">電話番号</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">備考</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {locations.map((location) => (
                            <tr key={location.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                                        {location.name}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{location.postalCode || '-'}</td>
                                <td className="px-4 py-3 text-gray-600">
                                    {location.prefecture}{location.city}{location.street}
                                    {location.building && <div className="text-xs text-gray-400">{location.building}</div>}
                                    {!location.prefecture && !location.city && !location.street && '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                    {location.phone ? (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                                            {location.phone}
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={location.notes || undefined}>
                                    {location.notes || '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(location)}
                                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded transition-colors"
                                            title="編集"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete({ id: location.id, name: location.name })}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="削除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {locations.length === 0 && (
                    <div className="text-center py-12 bg-white">
                        <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-500">拠点が登録されていません</p>
                    </div>
                )}
            </div>

            <LocationModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmit}
                editingLocation={editingLocation}
                error={error}
            />

            <ConfirmationModal
                isOpen={!!confirmDelete}
                title="拠点の削除"
                message={`拠点「${confirmDelete?.name}」を削除しますか？この操作は取り消せません。`}
                onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                variant="danger"
            />
        </div>
    );
}
