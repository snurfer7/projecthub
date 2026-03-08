import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Company } from '../types';
import Modal from './Modal';

interface CompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingCompany?: Company | null;
}

export default function CompanyModal({ isOpen, onClose, onSuccess, editingCompany }: CompanyModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [companyPostalCode, setCompanyPostalCode] = useState('');
    const [companyPrefecture, setCompanyPrefecture] = useState('');
    const [companyCity, setCompanyCity] = useState('');
    const [companyStreet, setCompanyStreet] = useState('');
    const [companyBuilding, setCompanyBuilding] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyWebsite, setCompanyWebsite] = useState('');
    const [companyNotes, setCompanyNotes] = useState('');
    const [companyError, setCompanyError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (editingCompany) {
                setCompanyName(editingCompany.name);
                setCompanyPostalCode(editingCompany.postalCode || '');
                setCompanyPrefecture(editingCompany.prefecture || '');
                setCompanyCity(editingCompany.city || '');
                setCompanyStreet(editingCompany.street || '');
                setCompanyBuilding(editingCompany.building || '');
                setCompanyPhone(editingCompany.phone || '');
                setCompanyWebsite(editingCompany.website || '');
                setCompanyNotes(editingCompany.notes || '');
            } else {
                setCompanyName('');
                setCompanyPostalCode('');
                setCompanyPrefecture('');
                setCompanyCity('');
                setCompanyStreet('');
                setCompanyBuilding('');
                setCompanyPhone('');
                setCompanyWebsite('');
                setCompanyNotes('');
            }
            setCompanyError('');
        }
    }, [isOpen, editingCompany]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setCompanyError('');
        try {
            const data = {
                name: companyName,
                postalCode: companyPostalCode || null,
                prefecture: companyPrefecture || null,
                city: companyCity || null,
                street: companyStreet || null,
                building: companyBuilding || null,
                phone: companyPhone || null,
                website: companyWebsite || null,
                notes: companyNotes || null,
            };
            if (editingCompany) {
                await api.put(`/admin/companies/${editingCompany.id}`, data);
            } else {
                await api.post('/admin/companies', data);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setCompanyError(err.response?.data?.error || (editingCompany ? '更新に失敗しました' : '作成に失敗しました'));
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingCompany ? '会社情報編集' : '会社登録'}
        >
            {companyError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{companyError}</div>}
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">会社名 *</label>
                        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                        <input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                        <input type="text" value={companyPostalCode} onChange={(e) => setCompanyPostalCode(e.target.value)} placeholder="000-0000"
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">都道府県</label>
                        <input type="text" value={companyPrefecture} onChange={(e) => setCompanyPrefecture(e.target.value)} placeholder="東京都"
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">市区町村</label>
                        <input type="text" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} placeholder="千代田区"
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">番地</label>
                        <input type="text" value={companyStreet} onChange={(e) => setCompanyStreet(e.target.value)} placeholder="1-1-1"
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">建物名・部屋番号</label>
                    <input type="text" value={companyBuilding} onChange={(e) => setCompanyBuilding(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Webサイト</label>
                    <input type="text" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                    <textarea value={companyNotes} onChange={(e) => setCompanyNotes(e.target.value)} rows={2}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
                        {editingCompany ? '更新' : '作成'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
