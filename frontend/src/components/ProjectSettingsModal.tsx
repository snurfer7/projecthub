import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { Project, Company, ProjectRelatedCompany } from '../types';
import Modal from './Modal';

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
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">プロジェクト名 *</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">識別子</label>
                        <input type="text" value={identifier} disabled
                            className="w-full border rounded-md px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
                            <option value="active">有効</option>
                            <option value="closed">終了</option>
                            <option value="archived">アーカイブ</option>
                        </select>
                    </div>


                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">親プロジェクト</label>
                        <select value={parentId} onChange={(e) => setParentId(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
                            <option value="">なし</option>
                            {allProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">期限日</label>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y" />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2 mt-8">取引先情報</h3>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">会社</label>
                        <select value={companyId} onChange={(e) => handleCompanyChange(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
                            <option value="">なし</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">拠点</label>
                            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
                                disabled={!companyId}
                                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                                <option value="">なし</option>
                                {availableLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                            <select value={contactId} onChange={(e) => setContactId(e.target.value)}
                                disabled={!companyId}
                                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                                <option value="">なし</option>
                                {availableContacts.map((c) => <option key={c.id} value={c.id}>{c.lastName} {c.firstName}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3}
                            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y" />
                    </div>

                    <div className="mt-8 mb-6 border-t pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">関連会社</h3>
                            <button type="button" onClick={handleAddRelatedCompany}
                                className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 py-1 px-2 rounded hover:bg-sky-50 transition-colors">
                                <Plus className="w-4 h-4" />追加
                            </button>
                        </div>

                        {relatedCompanies.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm">
                                関連会社はありません
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {relatedCompanies.map((rc, index) => {
                                    const c = companies.find(comp => comp.id === rc.companyId);
                                    const rclocations = c?.locations || [];
                                    const rccontacts = c?.contacts || [];

                                    return (
                                        <div key={index} className="p-4 border rounded-lg bg-gray-50/50 relative group">
                                            <button type="button" onClick={() => handleRemoveRelatedCompany(index)}
                                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">会社</label>
                                                    <select value={rc.companyId || ''} onChange={(e) => updateRelatedCompany(index, 'companyId', Number(e.target.value))}
                                                        className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
                                                        <option value="">選択してください</option>
                                                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">拠点</label>
                                                        <select value={rc.locationId || ''} onChange={(e) => updateRelatedCompany(index, 'locationId', e.target.value ? Number(e.target.value) : null)}
                                                            disabled={!rc.companyId}
                                                            className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:bg-gray-100">
                                                            <option value="">なし</option>
                                                            {rclocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">担当者</label>
                                                        <select value={rc.contactId || ''} onChange={(e) => updateRelatedCompany(index, 'contactId', e.target.value ? Number(e.target.value) : null)}
                                                            disabled={!rc.companyId}
                                                            className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:bg-gray-100">
                                                            <option value="">なし</option>
                                                            {rccontacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.lastName} {contact.firstName}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">備考</label>
                                                    <textarea value={rc.remarks || ''} onChange={(e) => updateRelatedCompany(index, 'remarks', e.target.value)} rows={2}
                                                        className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
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
