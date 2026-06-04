import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmationConfirmExtra = {
    /** 活動削除などで「紐づくファイル用コメントも削除」チェックが表示されたときの値 */
    deleteLinkedCompanyComment?: boolean;
};

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (extra?: ConfirmationConfirmExtra) => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info';
    /** 表示時のみ。確定時に `onConfirm({ deleteLinkedCompanyComment })` に渡す */
    linkedCommentDeleteCheckbox?: {
        label: string;
        defaultChecked?: boolean;
    };
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = '確定',
    cancelText = 'キャンセル',
    variant = 'danger',
    linkedCommentDeleteCheckbox,
}: Props) {
    const [linkedDeleteChecked, setLinkedDeleteChecked] = useState(true);

    useEffect(() => {
        if (isOpen && linkedCommentDeleteCheckbox) {
            setLinkedDeleteChecked(linkedCommentDeleteCheckbox.defaultChecked !== false);
        }
    }, [isOpen, linkedCommentDeleteCheckbox]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (linkedCommentDeleteCheckbox) {
            onConfirm({ deleteLinkedCompanyComment: linkedDeleteChecked });
        } else {
            onConfirm();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 pb-4 flex items-start gap-4">
                    <div className={`p-2 rounded-full flex-shrink-0 ${variant === 'danger' ? 'bg-red-100 text-red-600'
                        : 'bg-sky-100 text-sky-600'
                        }`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
                        {linkedCommentDeleteCheckbox && (
                            <label className="mt-4 flex items-start gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={linkedDeleteChecked}
                                    onChange={(e) => setLinkedDeleteChecked(e.target.checked)}
                                    className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-sm text-slate-700 leading-snug">
                                    {linkedCommentDeleteCheckbox.label}
                                </span>
                            </label>
                        )}
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${variant === 'danger'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-sky-600 hover:bg-sky-700'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
