import { ReactNode, useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-3xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl',
        '2xl': 'max-w-7xl',
        full: 'max-w-full mx-4',
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div
                className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col my-auto`}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b bg-white rounded-t-lg">
                        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 focus:outline-none"
                            aria-label="閉じる"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    {children}
                </div>
                {footer != null && (
                    <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-white rounded-b-lg">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
