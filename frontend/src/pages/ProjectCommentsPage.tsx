import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trash2, Send, Pencil } from 'lucide-react';
import api from '../api/client';
import { Project, ProjectComment } from '../types';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ConfirmationModal from '../components/ConfirmationModal';
import CommentModal from '../components/CommentModal';


interface ProjectContext {
    project: Project;
    loadProject: () => void;
}

export default function ProjectCommentsPage() {
    const { project, loadProject } = useOutletContext<ProjectContext>();
    const { user } = useAuth();
    const [comments, setComments] = useState<ProjectComment[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingComment, setEditingComment] = useState<ProjectComment | null>(null);


    const loadComments = async () => {
        if (!project?.id) return;
        try {
            const res = await api.get(`/projects/${project.id}/comments`);
            setComments(res.data);
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    };

    useEffect(() => {
        loadComments();
    }, [project?.id]);

    const handleDownload = async (attachmentId: number) => {
        try {
            const res = await api.post(`/attachments/token/${attachmentId}`);
            const { token } = res.data;
            window.open(`/api/attachments/file/${attachmentId}?downloadToken=${token}`, '_blank');
        } catch (e) {
            alert('ファイルの取得に失敗しました');
        }
    };

    const handleOpenCreateModal = () => {
        setModalMode('create');
        setEditingComment(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (comment: ProjectComment) => {
        setModalMode('edit');
        setEditingComment(comment);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (content: string, files: File[]) => {
        try {
            if (modalMode === 'create' || modalMode === 'edit') {
                let commentId: number;
                if (modalMode === 'create') {
                    const res = await api.post(`/projects/${project.id}/comments`, { content });
                    commentId = res.data.id;
                } else {
                    await api.put(`/projects/${project.id}/comments/${editingComment!.id}`, { content });
                    commentId = editingComment!.id;
                }

                if (files.length > 0) {
                    await Promise.all(files.map(async (file) => {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('projectCommentId', String(commentId));
                        formData.append('projectId', String(project.id));
                        return api.post('/attachments/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    }));
                }
            }

            await loadComments();
            loadProject();
        } catch (err) {
            alert(`コメントの${modalMode === 'create' ? '追加' : '更新'}に失敗しました`);
            throw err;
        }
    };
    const handleDeleteComment = async (commentId: number) => {
        try {
            await api.delete(`/projects/${project.id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setConfirmDeleteId(null);
            loadProject(); // Update comment count in tabs
        } catch {
            alert('コメントの削除に失敗しました');
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-700">コメント ({comments.length})</h2>
                <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-1.5 bg-sky-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-sky-700 transition-colors shadow-sm"
                >
                    <Send className="w-3.5 h-3.5" />
                    コメントを追加
                </button>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative">
            <div className="p-6 space-y-6">
                {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8 italic">
                        コメントはまだありません。
                    </p>
                ) : (
                    <div className="space-y-6">
                        {comments.map(comment => (
                            <div key={comment.id} className="flex gap-4 group">
                                <div className="w-10 h-10 rounded-full bg-sky-100 flex-shrink-0 flex items-center justify-center text-sm font-bold text-sky-700">
                                    {comment.user.lastName[0]}{comment.user.firstName[0]}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {comment.user.lastName} {comment.user.firstName}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-3">
                                                {new Date(comment.createdAt).toLocaleString('ja-JP')}
                                            </span>
                                        </div>
                                        {(user?.isAdmin || user?.id === comment.userId) && (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button
                                                    onClick={() => handleOpenEditModal(comment)}
                                                    className="p-1 text-gray-400 hover:text-sky-600 rounded hover:bg-sky-50 transition-colors"
                                                    title="編集"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(comment.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                                    title="削除"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100 mt-1 markdown-content">
                                        <MarkdownRenderer content={comment.content} />
                                    </div>
                                    {comment.attachments && comment.attachments.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {comment.attachments.map((a) => (
                                                <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-white shadow-sm">
                                                    <button
                                                        onClick={() => handleDownload(a.id)}
                                                        className="text-sky-600 hover:text-sky-700 font-medium text-xs truncate max-w-[200px]"
                                                        title={a.filename}
                                                    >
                                                        {a.filename}
                                                    </button>
                                                    <span className="text-[10px] text-gray-400 border-l border-slate-100 pl-1.5 flex-shrink-0">
                                                        {(a.fileSize / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>

            <CommentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMode === 'create' ? 'コメントの追加' : 'コメントの編集'}
                initialContent={editingComment?.content || ''}
                onSubmit={handleModalSubmit}
                submitLabel={modalMode === 'create' ? '投稿する' : '保存'}
                showAttachments={true}
            />

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                title="コメントの削除"
                message="このコメントを削除しますか？この操作は取り消せません。"
                onConfirm={() => confirmDeleteId && handleDeleteComment(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
                variant="danger"
            />
        </div>
    );
}
