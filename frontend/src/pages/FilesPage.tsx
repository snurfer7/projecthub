import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { Attachment } from '../types';
import { Trash2 } from 'lucide-react';


export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => api.get(`/attachments/project/${projectId}`).then((res) => setFiles(res.data));

  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId!);
      await api.post('/attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このファイルを削除しますか？')) return;
    await api.delete(`/attachments/${id}`);
    load();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ファイル</h1>
        <label className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700 cursor-pointer">
          {uploading ? 'アップロード中...' : 'ファイルを追加'}
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ファイル名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">サイズ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">アップロード者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">日時</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={`/api/attachments/download/${file.id}`} className="text-sky-600 hover:underline">{file.filename}</a>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatSize(file.fileSize)}</td>
                <td className="px-4 py-3 text-gray-600">{file.author.lastName} {file.author.firstName}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(file.createdAt).toLocaleString('ja-JP')}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleDelete(file.id)} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {files.length === 0 && (
          <div className="text-center py-8 text-gray-500">ファイルがありません</div>
        )}
      </div>
    </div>
  );
}
