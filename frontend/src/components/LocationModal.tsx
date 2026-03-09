import { useState, useEffect, FormEvent } from 'react';
import Modal from './Modal';
import { Location } from '../types';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    editingLocation: Location | null;
    error?: string;
}

export default function LocationModal({ isOpen, onClose, onSubmit, editingLocation, error }: LocationModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        postalCode: '',
        prefecture: '',
        city: '',
        street: '',
        building: '',
        notes: '',
    });

    useEffect(() => {
        if (editingLocation) {
            setFormData({
                name: editingLocation.name || '',
                phone: editingLocation.phone || '',
                postalCode: editingLocation.postalCode || '',
                prefecture: editingLocation.prefecture || '',
                city: editingLocation.city || '',
                street: editingLocation.street || '',
                building: editingLocation.building || '',
                notes: editingLocation.notes || '',
            });
        } else {
            setFormData({
                name: '',
                phone: '',
                postalCode: '',
                prefecture: '',
                city: '',
                street: '',
                building: '',
                notes: '',
            });
        }
    }, [editingLocation, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingLocation ? '拠点編集' : '拠点登録'}
        >
            {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">拠点名 *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                        <input
                            type="text"
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                            placeholder="000-0000"
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">都道府県</label>
                        <input
                            type="text"
                            value={formData.prefecture}
                            onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">市区町村</label>
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">町域・番地</label>
                    <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">建物名・部屋番号</label>
                    <input
                        type="text"
                        value={formData.building}
                        onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm"
                    >
                        {editingLocation ? '更新' : '作成'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
