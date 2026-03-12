import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { Project, Company, ProjectRelatedCompany } from '../types';
import Modal from './Modal';
import Combobox from './Combobox';
import TextInput from './TextInput';
import DateInput from './DateInput';

interface ProjectSettingsModalProps {
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export default function ProjectSettingsModal({ projectId, isOpen, onClose, onUpdate }: ProjectSettingsModalProps) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [name, setName] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('active');
    const [companyId, setCompanyId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [contactId, setContactId] = useState('');
    const [parentId, setParentId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [remarks, setRemarks] = useState('');
    const [relatedCompanies, setRelatedCompanies] = useState<Partial<ProjectRelatedCompany>[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        Promise.all([
            api.get(`/projects/${projectId}`),
            api.get('/companies'),
            api.get('/projects'),
        ]).then(([projectRes, companiesRes, projectsRes]) => {
            const p: Project = projectRes.data;
            setName(p.name);
            setIdentifier(p.identifier);
            setDescription(p.description || '');
            setStatus(p.status);
            setCompanyId(p.companyId ? String(p.companyId) : '');
            setLocationId(p.locationId ? String(p.locationId) : '');
            setContactId(p.contactId ? String(p.contactId) : '');
            setParentId(p.parentId ? String(p.parentId) : '');
            setDueDate(p.dueDate ? p.dueDate.slice(0, 10) : '');
            setRemarks(p.remarks || '');
            setRelatedCompanies(p.relatedCompanies || []);
            setCompanies(companiesRes.data);
            setAllProjects(projectsRes.data.filter((pr: Project) => pr.id !== projectId));
            setLoading(false);
        });
    }, [projectId, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await api.put(`/projects/${projectId}`, {
                name,
                description,
                status,
                companyId: companyId ? Number(companyId) : null,
                locationId: locationId ? Number(locationId) : null,
                contactId: contactId ? Number(contactId) : null,
                parentId: parentId ? Number(parentId) : null,
                dueDate: dueDate || null,
                remarks: remarks || null,
                relatedCompanies: relatedCompanies.filter(rc => rc.companyId).map(rc => ({
                    companyId: Number(rc.companyId),
                    locationId: rc.locationId ? Number(rc.locationId) : null,
                    contactId: rc.contactId ? Number(rc.contactId) : null,
                    remarks: rc.remarks || null
                })),
            });
            onUpdate();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || '保存に失敗しました');
        }
    };

    if (loading && isOpen) return null;

    const selectedCompany = companies.find(c => String(c.id) === companyId);
    const availableLocations = selectedCompany?.locations || [];
    const availableContacts = selectedCompany?.contacts || [];

    const handleCompanyChange = (id: string) => {
        setCompanyId(id);
        setLocationId('');
        setContactId('');
    };

    const handleAddRelatedCompany = () => {
        setRelatedCompanies([...relatedCompanies, { companyId: 0, remarks: '' }]);
    };

    const handleRemoveRelatedCompany = (index: number) => {
        setRelatedCompanies(relatedCompanies.filter((_, i) => i !== index));
    };

    const updateRelatedCompany = (index: number, field: keyof ProjectRelatedCompany, value: any) => {
        const newRCs = [...relatedCompanies];
        newRCs[index] = { ...newRCs[index], [field]: value };
        if (field === 'companyId') {
            newRCs[index].locationId = null;
            newRCs[index].contactId = null;
        }
        setRelatedCompanies(newRCs);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="プロジェクト設定"
        >
            <div className="bg-gray-50 -mx-6 -mt-6 p-6 mb-6 border-b">
                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm border border-red-200">{error}</div>}

                <form id="project-form" onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">基本情報</h3>
                    <div className="space-y-4">
                        <TextInput
                            label="プロジェクト名 *"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <TextInput
                            label="識別子"
                            value={identifier}
                            disabled
                        />

                        <Combobox
                            label="ステータス"
                            options={[
                                { value: 'active', label: '有効' },
                                { value: 'closed', label: '終了' },
                                { value: 'archived', label: 'アーカイブ' }
                            ]}
                            value={status}
                            onChange={setStatus}
                        />

                        <Combobox
                            label="親プロジェクト"
                            options={allProjects.map((p) => ({ value: String(p.id), label: p.name }))}

                            value={parentId}
                            onChange={setParentId}
                        />

                        <DateInput
                            label="期限日"
                            id="project-due-date"
                            value={dueDate}
                            onChange={setDueDate}
                        />

                        <TextInput
                            label="説明"
                            isMultiline
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                        />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2 mt-10">企業</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Combobox
                                label="企業"
                                options={companies.map((c) => ({ value: String(c.id), label: c.name }))}

                                value={companyId}
                                onChange={handleCompanyChange}
                            />
                            <Combobox
                                label="拠点"
                                options={availableLocations.map((l) => ({ value: String(l.id), label: l.name }))}

                                value={locationId}
                                onChange={setLocationId}
                                disabled={!companyId}
                            />
                            <Combobox
                                label="担当者"
                                options={availableContacts.map((c) => ({ value: String(c.id), label: `${c.lastName} ${c.firstName}` }))}

                                value={contactId}
                                onChange={setContactId}
                                disabled={!companyId}
                            />
                        </div>

                        <TextInput
                            label="備考"
                            isMultiline
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="mt-10 mb-6 border-t pt-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-gray-800">関連企業</h3>
                            <button type="button" onClick={handleAddRelatedCompany}
                                className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 py-1 px-2 rounded hover:bg-sky-50 transition-colors">
                                <Plus className="w-4 h-4" />追加
                            </button>
                        </div>

                        {relatedCompanies.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm">
                                関連企業はありません
                            </div>
                        ) : (
                            <div className="divide-y border rounded-lg bg-white overflow-hidden">
                                {relatedCompanies.map((rc, index) => {
                                    const c = companies.find(comp => comp.id === rc.companyId);
                                    const rclocations = c?.locations || [];
                                    const rccontacts = c?.contacts || [];

                                    return (
                                        <div key={index} className="p-3 bg-white hover:bg-gray-50/50 transition-colors">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <Combobox
                                                            label="企業"
                                                            options={companies.map((c) => ({ value: String(c.id), label: c.name }))}

                                                            value={rc.companyId || ''}
                                                            onChange={(val) => updateRelatedCompany(index, 'companyId', Number(val))}
                                                        />
                                                        <Combobox
                                                            label="拠点"
                                                            options={rclocations.map((l) => ({ value: String(l.id), label: l.name }))}

                                                            value={rc.locationId ? String(rc.locationId) : ''}
                                                            onChange={(val) => updateRelatedCompany(index, 'locationId', val ? Number(val) : null)}
                                                            disabled={!rc.companyId}
                                                        />
                                                        <Combobox
                                                            label="担当者"
                                                            options={rccontacts.map((contact) => ({ value: String(contact.id), label: `${contact.lastName} ${contact.firstName}` }))}

                                                            value={rc.contactId ? String(rc.contactId) : ''}
                                                            onChange={(val) => updateRelatedCompany(index, 'contactId', val ? Number(val) : null)}
                                                            disabled={!rc.companyId}
                                                        />
                                                    </div>
                                                    <button type="button" onClick={() => handleRemoveRelatedCompany(index)}
                                                        className="mt-5 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="削除">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <TextInput
                                                    label="備考"
                                                    isMultiline
                                                    className="mt-4"
                                                    value={rc.remarks || ''}
                                                    onChange={(e) => updateRelatedCompany(index, 'remarks', e.target.value)}
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6 border-t pt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            キャンセル
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
                            更新
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
