import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Project, Company } from '../types';
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
    const [parentId, setParentId] = useState('');
    const [dueDate, setDueDate] = useState('');
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
            setParentId(p.parentId ? String(p.parentId) : '');
            setDueDate(p.dueDate ? p.dueDate.slice(0, 10) : '');
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
                parentId: parentId ? Number(parentId) : null,
                dueDate: dueDate || null,
            });
            onUpdate();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || '保存に失敗しました');
        }
    };

    if (loading && isOpen) return null;

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

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
                                <option value="active">有効</option>
                                <option value="closed">終了</option>
                                <option value="archived">アーカイブ</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">会社</label>
                            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white">
                                <option value="">なし</option>
                                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
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
