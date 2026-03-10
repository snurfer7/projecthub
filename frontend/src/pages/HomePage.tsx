import { useState, useEffect } from 'react';
import api from '../api/client';
import MarkdownRenderer from '../components/MarkdownRenderer';
import MarkdownEditor from '../components/MarkdownEditor';
import { Pencil } from 'lucide-react';


interface HomePage {
  id: number;
  content: string;
  updatedAt: string;
}

export default function HomePage() {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchHomePage();
  }, []);

  const fetchHomePage = async () => {
    try {
      const response = await api.get('/home');
      const data: HomePage = response.data;
      setContent(data.content);
      setLastUpdated(new Date(data.updatedAt));
    } catch (err) {
      console.error('Failed to fetch home page:', err);
      setError('ホームページの読み込みに失敗しました');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const response = await api.post('/home', { content });
      const data: HomePage = response.data;
      setContent(data.content);
      setLastUpdated(new Date(data.updatedAt));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save home page:', err);
      setError('ホームページの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    fetchHomePage();
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-full mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-800">ホーム</h1>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              title="編集"
              className="p-2 text-sky-600 hover:bg-sky-50 rounded"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {isEditing ? (
          <div>
            <div className="mb-4">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                rows={15}
                placeholder="Markdownで編集..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="bg-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-400 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none bg-slate-50 p-6 rounded-lg">
            <MarkdownRenderer content={content} />
          </div>
        )}

        {lastUpdated && (
          <div className="mt-6 text-sm text-slate-500">
            最終更新：{lastUpdated.toLocaleString('ja-JP')}
          </div>
        )}
      </div>
    </div>
  );
}
