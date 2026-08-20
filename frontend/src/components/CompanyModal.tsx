import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Company, LegalEntityStatus } from '../types';
import Modal from './Modal';
import TextInput from './TextInput';
import Combobox from './Combobox';
import { PREFECTURE_OPTIONS } from '../utils/prefectures';
import {
    formatPostalCode,
    convertToHalfWidth,
    COMPANY_TRANSACTION_MODE_OPTIONS,
    companyTransactionModeFromFlags,
    companyFlagsFromTransactionMode,
    type CompanyTransactionMode,
} from '../utils/format';
import MapPicker from './MapPicker';
import { fetchCoordinatesFromAddress } from '../utils/geocoding';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

interface CompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingCompany?: Company | null;
}

export default function CompanyModal({ isOpen, onClose, onSuccess, editingCompany }: CompanyModalProps) {
    const { user } = useAuth();
    const { canInputField } = usePermissions(user?.permissions);
    const transactionTypesDisabled = !canInputField('companies.fields.transactionTypes');
    const [companyName, setCompanyName] = useState('');
    const [transactionMode, setTransactionMode] = useState<CompanyTransactionMode>('sales');
    const [legalEntityStatusId, setLegalEntityStatusId] = useState<number | string>('');
    const [legalEntityPosition, setLegalEntityPosition] = useState<number | string>('');
    const [availableStatuses, setAvailableStatuses] = useState<LegalEntityStatus[]>([]);
    const [companyPostalCode, setCompanyPostalCode] = useState('');
    const [companyPrefecture, setCompanyPrefecture] = useState('');
    const [companyCity, setCompanyCity] = useState('');
    const [companyStreet, setCompanyStreet] = useState('');
    const [companyBuilding, setCompanyBuilding] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyFax, setCompanyFax] = useState('');
    const [companyWebsite, setCompanyWebsite] = useState('');
    const [companyNotes, setCompanyNotes] = useState('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
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
                setTransactionMode(companyTransactionModeFromFlags(editingCompany));
                setLegalEntityStatusId(editingCompany.legalEntityStatusId || '');
                setLegalEntityPosition(editingCompany.legalEntityPosition || '');
                setCompanyWebsite(editingCompany.website || '');
                setCompanyNotes(editingCompany.notes || '');
            } else {
                setCompanyName('');
                setTransactionMode('sales');
                setLegalEntityStatusId('');
                setLegalEntityPosition('');
                setCompanyPostalCode('');
                setCompanyPrefecture('');
                setCompanyCity('');
                setCompanyStreet('');
                setCompanyBuilding('');
                setCompanyPhone('');
                setCompanyFax('');
                setCompanyWebsite('');
                setCompanyNotes('');
                setLatitude(null);
                setLongitude(null);
            }
            setCompanyError('');
        }
    }, [isOpen, editingCompany]);

    const handleGeocode = async () => {
        const address = `${companyPrefecture}${companyCity}${companyStreet}`;
        if (address.trim()) {
            const coords = await fetchCoordinatesFromAddress(address);
            if (coords) {
                setLatitude(coords.lat);
                setLongitude(coords.lng);
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setCompanyError('');
        try {
            const data: any = {
                name: companyName,
                legalEntityStatusId: legalEntityStatusId || null,
                legalEntityPosition: legalEntityPosition || null,
                website: companyWebsite || null,
                notes: companyNotes || null,
            };
            if (!transactionTypesDisabled) {
                Object.assign(data, companyFlagsFromTransactionMode(transactionMode));
            }

            // 新規作成時のみ住所情報を送信する（拠点の初期登録用）
            if (!editingCompany) {
                Object.assign(data, {
                    postalCode: companyPostalCode || null,
                    prefecture: companyPrefecture || null,
                    city: companyCity || null,
                    street: companyStreet || null,
                    building: companyBuilding || null,
                    phone: companyPhone || null,
                    fax: companyFax || null,
                    latitude,
                    longitude,
                });
            }

            if (editingCompany) {
                await api.put(`/companies/${editingCompany.id}`, data);
            } else {
                await api.post('/companies', data);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setCompanyError(err.response?.data?.error || (editingCompany ? '更新に失敗しました' : '作成に失敗しました'));
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={editingCompany ? '企業情報編集' : '企業登録'}
                footer={
                    <>
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
                        <button type="submit" form="company-modal-form" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
                            {editingCompany ? '更新' : '作成'}
                        </button>
                    </>
                }
            >
                {companyError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{companyError}</div>}
                <form id="company-modal-form" onSubmit={handleSubmit} className="space-y-4">
                    <TextInput
                        label="企業名 *"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                    />
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <Combobox
                            label="法人格"
                            options={availableStatuses.map(s => ({ value: String(s.id), label: s.name }))}
                            value={legalEntityStatusId}
                            onChange={(val) => {
                                setLegalEntityStatusId(val);
                                if (!val) {
                                    setLegalEntityPosition('');
                                } else if (!legalEntityStatusId) {
                                    // Only set default "前" if we are transitioning from unselected to selected
                                    setLegalEntityPosition('前');
                                }
                            }}
                        />
                        <div>
                            <div className="block text-xs text-gray-500 mb-1">法人格前後</div>
                            <div
                                className={`inline-flex rounded-md border border-gray-300 overflow-hidden ${
                                    !legalEntityStatusId ? 'opacity-50' : ''
                                }`}
                                role="group"
                                aria-label="法人格前後"
                            >
                                {(['前', '後'] as const).map((pos, idx) => {
                                    const selected = legalEntityPosition === pos;
                                    const disabled = !legalEntityStatusId;
                                    return (
                                        <button
                                            key={pos}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => setLegalEntityPosition(pos)}
                                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                idx > 0 ? 'border-l border-gray-300' : ''
                                            } ${
                                                selected
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                            } ${disabled ? 'cursor-not-allowed' : ''}`}
                                        >
                                            {pos}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <div className="block text-xs text-gray-500 mb-1">取引区分</div>
                            <div
                                className={`inline-flex rounded-md border border-gray-300 overflow-hidden ${
                                    transactionTypesDisabled ? 'opacity-50' : ''
                                }`}
                                role="group"
                                aria-label="取引区分"
                            >
                                {COMPANY_TRANSACTION_MODE_OPTIONS.map((opt, idx) => {
                                    const selected = transactionMode === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            disabled={transactionTypesDisabled}
                                            onClick={() => setTransactionMode(opt.value)}
                                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                idx > 0 ? 'border-l border-gray-300' : ''
                                            } ${
                                                selected
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                            } ${transactionTypesDisabled ? 'cursor-not-allowed' : ''}`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {!editingCompany && (
                        <>
                            <div className="grid grid-cols-2 gap-6">
                                <TextInput
                                    label="郵便番号"
                                    value={companyPostalCode}
                                    onChange={(e) => setCompanyPostalCode(formatPostalCode(e.target.value))}
                                    placeholder="000-0000"
                                />

                                <Combobox
                                    label="都道府県"
                                    options={PREFECTURE_OPTIONS}
                                    value={companyPrefecture}
                                    onChange={(val) => {
                                        setCompanyPrefecture(val);
                                    }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <TextInput
                                    label="市区町村"
                                    value={companyCity}
                                    onChange={(e) => setCompanyCity(e.target.value)}
                                    onBlur={(e) => {
                                        setCompanyCity(convertToHalfWidth(e.target.value));
                                        handleGeocode();
                                    }}
                                    placeholder="千代田区"
                                />
                                <TextInput
                                    label="町域・番地"
                                    value={companyStreet}
                                    onChange={(e) => setCompanyStreet(e.target.value)}
                                    onBlur={(e) => {
                                        setCompanyStreet(convertToHalfWidth(e.target.value));
                                        handleGeocode();
                                    }}
                                    placeholder="1-1-1"
                                />
                            </div>
                            <TextInput
                                label="建物名・部屋番号"
                                value={companyBuilding}
                                onChange={(e) => setCompanyBuilding(e.target.value)}
                                onBlur={(e) => setCompanyBuilding(convertToHalfWidth(e.target.value))}
                            />

                            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-700">位置情報 (緯度・経度)</h4>
                                </div>

                                <div className="pt-1 pb-2">
                                    <MapPicker 
                                        initialLat={latitude}
                                        initialLng={longitude}
                                        onChange={(lat, lng) => {
                                            setLatitude(lat);
                                            setLongitude(lng);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <TextInput
                                    label="電話番号"
                                    value={companyPhone}
                                    onChange={(e) => setCompanyPhone(e.target.value)}
                                />
                                <TextInput
                                    label="FAX"
                                    value={companyFax}
                                    onChange={(e) => setCompanyFax(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    <TextInput
                        label="Webサイト"
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                    />

                    <TextInput
                        label="備考"
                        isMultiline
                        value={companyNotes}
                        onChange={(e) => setCompanyNotes(e.target.value)}
                        rows={2}
                    />

                </form>
            </Modal>


        </>
    );
}
