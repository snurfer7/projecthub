import { useState, useEffect, FormEvent } from 'react';
import Modal from './Modal';
import { Location } from '../types';
import TextInput from './TextInput';
import Combobox from './Combobox';
import { PREFECTURE_OPTIONS } from '../utils/prefectures';
import { formatPostalCode, convertToHalfWidth } from '../utils/format';
import MapPicker from './MapPicker';
import { fetchCoordinatesFromAddress } from '../utils/geocoding';

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
        fax: '',
        postalCode: '',
        prefecture: '',
        city: '',
        street: '',
        building: '',
        notes: '',
        isProfileDisplay: false,
        latitude: null as number | null,
        longitude: null as number | null,
    });

    useEffect(() => {
        if (editingLocation) {
            setFormData({
                name: editingLocation.name || '',
                phone: editingLocation.phone || '',
                fax: editingLocation.fax || '',
                postalCode: editingLocation.postalCode || '',
                prefecture: editingLocation.prefecture || '',
                city: editingLocation.city || '',
                street: editingLocation.street || '',
                building: editingLocation.building || '',
                notes: editingLocation.notes || '',
                isProfileDisplay: editingLocation.isProfileDisplay || false,
                latitude: editingLocation.latitude ?? null,
                longitude: editingLocation.longitude ?? null,
            });
        } else {
            setFormData({
                name: '',
                phone: '',
                fax: '',
                postalCode: '',
                prefecture: '',
                city: '',
                street: '',
                building: '',
                notes: '',
                isProfileDisplay: false,
                latitude: null,
                longitude: null,
            });
        }
    }, [editingLocation, isOpen]);

    const handleGeocode = async () => {
        const address = `${formData.prefecture}${formData.city}${formData.street}`;
        if (address.trim()) {
            const coords = await fetchCoordinatesFromAddress(address);
            if (coords) {
                setFormData(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={editingLocation ? '拠点編集' : '拠点登録'}
            >
                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <TextInput
                                label="拠点名 *"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="pb-3 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isProfileDisplay"
                                checked={formData.isProfileDisplay}
                                onChange={(e) => setFormData({ ...formData, isProfileDisplay: e.target.checked })}
                                className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                            />
                            <label htmlFor="isProfileDisplay" className="text-sm font-medium text-gray-700 cursor-pointer">
                                企業概要に表示
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <TextInput
                            label="郵便番号"
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: formatPostalCode(e.target.value) })}
                            placeholder="000-0000"
                        />
                        <Combobox
                            label="都道府県"
                            options={PREFECTURE_OPTIONS}
                            value={formData.prefecture}
                            onChange={(val) => setFormData({ ...formData, prefecture: val })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <TextInput
                            label="市区町村"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            onBlur={(e) => {
                                setFormData({ ...formData, city: convertToHalfWidth(e.target.value) });
                                handleGeocode();
                            }}
                        />
                        <TextInput
                            label="町域・番地"
                            value={formData.street}
                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            onBlur={(e) => {
                                setFormData({ ...formData, street: convertToHalfWidth(e.target.value) });
                                handleGeocode();
                            }}
                        />
                    </div>
                    <TextInput
                        label="建物名・部屋番号"
                        value={formData.building}
                        onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                        onBlur={(e) => setFormData({ ...formData, building: convertToHalfWidth(e.target.value) })}
                    />

                    <div className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-700">位置情報</h4>
                        </div>

                        <div className="pt-1 pb-2">
                            <MapPicker 
                                initialLat={formData.latitude}
                                initialLng={formData.longitude}
                                onChange={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                            />
                        </div>


                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <TextInput
                            label="電話番号"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                        <TextInput
                            label="FAX"
                            value={formData.fax}
                            onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                        />
                    </div>

                    <TextInput
                        label="備考"
                        isMultiline
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                    />
                    <div className="flex justify-end gap-2 mt-6">
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


        </>
    );
}
