import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Project, Company } from '../types';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [parentId, setParentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/projects').then((res) => setProjects(res.data));
    api.get('/companies').then((res) => setCompanies(res.data));
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/projects', { name, identifier, description, companyId: companyId || null, parentId: parentId || null, dueDate: dueDate || null });
      setProjects([res.data, ...projects]);
      setShowForm(false);
      setName('');
      setIdentifier('');
      setDescription('');
      setCompanyId('');
      setParentId('');
      setDueDate('');
    } catch (err: any) {
      console.error('プロジェクト作成エラー:', err);
      const errorMsg = err.response?.data?.error || '作成に失敗しました';
      const errorDetails = err.response?.data?.details || '';
      setError(errorDetails ? `${errorMsg} (${errorDetails})` : errorMsg);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">プロジェクト</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
          新規プロジェクト
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">プロジェクト作成</h2>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
              <div>{error}</div>
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">プロジェクト名</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">識別子</label>
                <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
                  pattern="[a-z0-9-]+" title="小文字英数字とハイフンのみ"
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">会社</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                  <option value="">なし</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">親プロジェクト</label>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                  <option value="">なし</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">期限日</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">作成</button>
              <button type="button" onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {projects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`}
            className="bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{project.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {project.identifier}
                  {project.company && <span className="ml-2 text-sky-600">({project.company.name})</span>}
                  {project.parent && <span className="ml-2 text-purple-600">親: {project.parent.name}</span>}
                  {project.dueDate && <span className="ml-2 text-orange-600">期限: {new Date(project.dueDate).toLocaleDateString()}</span>}
                </p>
                {project.description && <p className="text-sm text-gray-600 mt-2">{project.description}</p>}
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  project.status === 'active' ? 'bg-green-100 text-green-700' :
                  project.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {project.status === 'active' ? '有効' : project.status === 'closed' ? '終了' : 'アーカイブ'}
                </span>
                {project._count && (
                  <p className="text-sm text-gray-500 mt-2">チケット: {project._count.issues}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">プロジェクトがありません。新規プロジェクトを作成してください。</div>
        )}
      </div>
    </div>
  );
}
