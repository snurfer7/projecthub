import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { ContactComment } from '../types';
import { Trash2, Send } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from './MarkdownEditor';
import MarkdownRenderer from './MarkdownRenderer';

interface ContactCommentsSectionProps {
  contactId: number;
}

export default function ContactCommentsSection({ contactId }: ContactCommentsSectionProps) {
  const [comments, setComments] = useState<ContactComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const { user } = useAuth();

  const loadComments = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/crm/contacts/${contactId}/comments`);
      setComments(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [contactId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post(`/crm/contacts/${contactId}/comments`, { content: newComment });
      setNewComment('');
      await loadComments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'コメントの投稿に失敗しました');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('このコメントを削除しますか？')) return;
    try {
      await api.delete(`/crm/contacts/${contactId}/comments/${commentId}`);
      await loadComments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'コメントの削除に失敗しました');
    }
  };

  if (loading) return <div className="text-center py-4 text-gray-400 text-sm">読み込み中...</div>;

  return (
    <div className="border rounded-md bg-gray-50">
      <div className="px-3 py-2 border-b bg-gray-100 rounded-t-md">
        <span className="text-sm font-medium text-slate-700">コメント ({comments.length})</span>
      </div>

      {/* Comments list */}
      <div className="max-h-48 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-3">コメントはありません</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xs">
                  {comment.user.lastName?.[0]}{comment.user.firstName?.[0]}
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-md p-2 border border-gray-200 relative group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-xs text-slate-700">
                      {comment.user.lastName} {comment.user.firstName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(comment.createdAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 markdown-content">
                    <MarkdownRenderer content={comment.content} />
                  </div>
                  {(user?.isAdmin || user?.id === comment.userId) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="absolute top-1.5 right-1.5 p-0.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded"
                      title="削除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <MarkdownEditor
            value={newComment}
            onChange={setNewComment}
            placeholder="コメントを入力..."
            rows={3}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="bg-sky-600 text-white px-3 py-1.5 rounded-md hover:bg-sky-700 text-xs disabled:bg-gray-400 flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3 h-3" /> 投稿
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
