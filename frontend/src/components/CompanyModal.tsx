import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Company, LegalEntityStatus } from '../types';
import Modal from './Modal';
import TextInput from './TextInput';
import Combobox from './Combobox';

interface CompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingCompany?: Company | null;
}

export default function CompanyModal({ isOpen, onClose, onSuccess, editingCompany }: CompanyModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [legalEntityStatusId, setLegalEntityStatusId] = useState<number | string>('');
    const [availableStatuses, setAvailableStatuses] = useState<LegalEntityStatus[]>([]);
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
        api.get('/admin/legal-entity-statuses')
            .then(res => setAvailableStatuses(res.data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (editingCompany) {
                setCompanyName(editingCompany.name);
                setLegalEntityStatusId(editingCompany.legalEntityStatusId || '');
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
                setLegalEntityStatusId('');
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
                legalEntityStatusId: legalEntityStatusId || null,
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
            title={editingCompany ? '企業情報編集' : '企業登録'}
        >
            {companyError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{companyError}</div>}
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <TextInput
                        label="企業名 *"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                    />
                    <Combobox
                        label="法人格"
                        options={availableStatuses.map(s => ({ value: String(s.id), label: s.name }))}

                        value={legalEntityStatusId}
                        onChange={setLegalEntityStatusId}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <TextInput
                        label="郵便番号"
                        value={companyPostalCode}
                        onChange={(e) => setCompanyPostalCode(e.target.value)}
                        placeholder="000-0000"
                    />
                    <TextInput
                        label="都道府県"
                        value={companyPrefecture}
                        onChange={(e) => setCompanyPrefecture(e.target.value)}
                        placeholder="東京都"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <TextInput
                        label="市区町村"
                        value={companyCity}
                        onChange={(e) => setCompanyCity(e.target.value)}
                        placeholder="千代田区"
                    />
                    <TextInput
                        label="番地"
                        value={companyStreet}
                        onChange={(e) => setCompanyStreet(e.target.value)}
                        placeholder="1-1-1"
                    />
                </div>
                <TextInput
                    label="建物名・部屋番号"
                    value={companyBuilding}
                    onChange={(e) => setCompanyBuilding(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
                    <TextInput
                        label="電話番号"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                    />
                    <TextInput
                        label="Webサイト"
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                    />
                </div>

                <TextInput
                    label="備考"
                    isMultiline
                    value={companyNotes}
                    onChange={(e) => setCompanyNotes(e.target.value)}
                    rows={2}
                />

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
