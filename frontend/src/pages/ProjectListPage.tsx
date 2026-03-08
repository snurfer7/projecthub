import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Project, Company } from '../types';
import Modal from '../components/Modal';


export default function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Project modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectIdentifier, setProjectIdentifier] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCompanyId, setProjectCompanyId] = useState('');
  const [projectParentId, setProjectParentId] = useState('');
  const [projectDueDate, setProjectDueDate] = useState('');
  const [projectError, setProjectError] = useState('');

  const loadProjects = () => {
    api.get('/projects').then((res) => setProjects(res.data));
  };

  const loadCompanies = () => {
    api.get('/companies').then((res) => setCompanies(res.data));
  };

  useEffect(() => {
    loadProjects();
    loadCompanies();
  }, []);

  const openCreateProjectModal = () => {
    setEditingProjectId(null);
    setProjectName('');
    setProjectIdentifier('');
    setProjectDescription('');
    setProjectCompanyId('');
    setProjectParentId('');
    setProjectDueDate('');
    setProjectError('');
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setEditingProjectId(null);
    setProjectError('');
  };

  const handleSubmitProject = async (e: FormEvent) => {
    e.preventDefault();
    setProjectError('');
    try {
      const data = {
        name: projectName,
        identifier: projectIdentifier,
        description: projectDescription || null,
        companyId: projectCompanyId ? Number(projectCompanyId) : null,
        parentId: projectParentId ? Number(projectParentId) : null,
        dueDate: projectDueDate || null,
      };
      if (editingProjectId) {
        await api.put(`/projects/${editingProjectId}`, data);
      } else {
        await api.post('/projects', data);
      }
      closeProjectModal();
      loadProjects();
    } catch (err: any) {
      setProjectError(err.response?.data?.error || (editingProjectId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q)
      || p.identifier.toLowerCase().includes(q)
      || (p.company && p.company.name.toLowerCase().includes(q));
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">プロジェクト</h1>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={openCreateProjectModal}
            className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
            新規プロジェクト
          </button>
          <input
            type="text"
            placeholder="プロジェクト名、識別子、会社名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">プロジェクト名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">識別子</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">会社</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">期限</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">チケット数</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr key={project.id} className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}>
                <td className="px-4 py-3 text-sky-600 font-medium">{project.name}</td>
                <td className="px-4 py-3 text-gray-600">{project.identifier}</td>
                <td className="px-4 py-3 text-gray-600">{project.company?.name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {project.dueDate ? new Date(project.dueDate).toLocaleDateString('ja-JP') : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">{project._count?.issues || 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${project.status === 'active' ? 'bg-green-100 text-green-700' :
                    project.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                    {project.status === 'active' ? '有効' : project.status === 'closed' ? '終了' : 'アーカイブ'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 && (
          <div className="text-center py-8 text-gray-500">プロジェクトが登録されていません</div>
        )}
      </div>

      {/* Project create/edit modal */}
      <Modal
        isOpen={showProjectModal}
        onClose={closeProjectModal}
        title={editingProjectId ? 'プロジェクト情報編集' : 'プロジェクト登録'}
      >
        {projectError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{projectError}</div>}
        <form onSubmit={handleSubmitProject}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">プロジェクト名 *</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} required
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">識別子 *</label>
              <input type="text" value={projectIdentifier} onChange={(e) => setProjectIdentifier(e.target.value)} required
                pattern="[a-z0-9-]+" title="小文字英数字とハイフンのみ"
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">会社</label>
              <select value={projectCompanyId} onChange={(e) => setProjectCompanyId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">なし</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">親プロジェクト</label>
              <select value={projectParentId} onChange={(e) => {
                const val = e.target.value;
                setProjectParentId(val);
                if (val) {
                  const parent = projects.find((p) => String(p.id) === val);
                  if (parent?.dueDate) {
                    setProjectDueDate(parent.dueDate.slice(0, 10));
                  }
                }
              }}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">なし</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">期限日</label>
            <input type="date" value={projectDueDate} onChange={(e) => setProjectDueDate(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={3}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeProjectModal}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              {editingProjectId ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
