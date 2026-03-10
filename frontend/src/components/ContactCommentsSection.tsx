import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { ContactComment } from '../types';
import { Trash2, Send, Paperclip, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from './MarkdownEditor';
import MarkdownRenderer from './MarkdownRenderer';
import ConfirmationModal from './ConfirmationModal';


interface ContactCommentsSectionProps {
  contactId: number;
}

export default function ContactCommentsSection({ contactId }: ContactCommentsSectionProps) {
  const [comments, setComments] = useState<ContactComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
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

  const handleDownload = async (attachmentId: number) => {
    try {
      const res = await api.post(`/attachments/token/${attachmentId}`);
      const { token } = res.data;
      window.open(`/api/attachments/file/${attachmentId}?downloadToken=${token}`, '_blank');
    } catch (e) {
      alert('ファイルの取得に失敗しました');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/crm/contacts/${contactId}/comments`, { content: newComment });

      if (commentFiles.length > 0) {
        await Promise.all(commentFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('contactCommentId', String(res.data.id));
          return api.post('/attachments/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }));
      }

      setNewComment('');
      setCommentFiles([]);
      await loadComments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'コメントの投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await api.delete(`/crm/contacts/${contactId}/comments/${commentId}`);
      setConfirmDeleteId(null);
      await loadComments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'コメントの削除に失敗しました');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setCommentFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  if (loading) return <div className="text-center py-4 text-gray-400 text-sm">読み込み中...</div>;

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative ${isDragging ? 'bg-sky-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-sky-500/10 pointer-events-none rounded-lg">
          <div className="bg-white px-4 py-3 rounded-lg shadow-lg border-2 border-dashed border-sky-400 animate-in fade-in zoom-in duration-150">
            <p className="text-sky-600 font-medium flex items-center gap-1.5 text-xs">
              <Paperclip className="w-4 h-4" />
              ファイルをドロップして添付
            </p>
          </div>
        </div>
      )}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
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
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {comment.attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(a.id)}
                            className="text-sky-600 hover:underline text-[10px] flex items-center gap-1 text-left"
                          >
                            <span className="bg-slate-50 px-1 rounded border border-slate-200 text-[9px]">FILE</span> {a.filename}
                          </button>
                          <span className="text-[9px] text-gray-400">({(a.fileSize / 1024).toFixed(1)} KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(user?.isAdmin || user?.id === comment.userId) && (
                    <button
                      onClick={() => setConfirmDeleteId(comment.id)}
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
          <div className="space-y-2">
            {commentFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {commentFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 text-[9px]">
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setCommentFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 bg-white hover:bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-200 text-[10px] cursor-pointer transition-colors">
                  <Paperclip className="w-3 h-3" />
                  ファイルを添付
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setCommentFiles(prev => [...prev, ...files]);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="bg-sky-600 text-white px-3 py-1.5 rounded-md hover:bg-sky-700 text-xs disabled:bg-gray-400 flex items-center gap-1.5 transition-colors"
              >
                {submitting ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                投稿
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        title="コメントの削除"
        message="このコメントを削除しますか？この操作は取り消せません。"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}
