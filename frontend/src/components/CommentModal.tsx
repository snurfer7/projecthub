import { useState, useEffect, FormEvent } from 'react';
import { Send, Paperclip, X, Check } from 'lucide-react';
import Modal from './Modal';
import MarkdownEditor from './MarkdownEditor';

interface CommentModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    initialContent?: string;
    onSubmit: (content: string, files: File[]) => Promise<void>;
    submitLabel?: string;
    showAttachments?: boolean;
}

export default function CommentModal({
    isOpen,
    onClose,
    title,
    initialContent = '',
    onSubmit,
    submitLabel = '投稿する',
    showAttachments = true,
}: CommentModalProps) {
    const [content, setContent] = useState(initialContent);
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setContent(initialContent);
            setFiles([]);
        }
    }, [isOpen, initialContent]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setSubmitting(true);
        try {
            await onSubmit(content, files);
            onClose();
        } catch (err) {
            console.error('Failed to submit comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (!showAttachments) return;
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!showAttachments) return;
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!showAttachments) return;
        e.preventDefault();
        setIsDragging(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div
                    className={`relative ${isDragging ? 'bg-sky-50' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isDragging && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-sky-500/10 pointer-events-none rounded-lg border-2 border-dashed border-sky-400">
                            <p className="text-sky-600 font-medium flex items-center gap-2">
                                <Paperclip className="w-5 h-5" />
                                ファイルをドロップして添付
                            </p>
                        </div>
                    )}
                    <MarkdownEditor
                        value={content}
                        onChange={setContent}
                        placeholder="コメントを入力..."
                        rows={8}
                        autoFocus
                    />
                </div>

                {showAttachments && (
                    <div className="space-y-3">
                        {files.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 text-xs">
                                        <span className="truncate max-w-[200px]">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded border border-slate-200 text-xs cursor-pointer transition-colors">
                                <Paperclip className="w-3.5 h-3.5" />
                                ファイルを添付
                                <input
                                    type="file"
                                    className="sr-only"
                                    multiple
                                    onChange={(e) => {
                                        const newFiles = Array.from(e.target.files || []);
                                        if (newFiles.length > 0) {
                                            setFiles(prev => [...prev, ...newFiles]);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        disabled={!content.trim() || submitting}
                        className="bg-sky-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {submitting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            submitLabel === '保存' ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />
                        )}
                        {submitLabel}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
