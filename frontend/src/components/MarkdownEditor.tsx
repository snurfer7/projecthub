import React, { useRef, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    placeholder?: string;
    className?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    rows = 10,
    placeholder = '',
    className = '',
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

    const insertText = (before: string, after: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        const newValue =
            value.substring(0, start) +
            before +
            selectedText +
            after +
            value.substring(end);

        onChange(newValue);

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            const newCursorStart = start + before.length;
            const newCursorEnd = end + before.length;
            textarea.setSelectionRange(newCursorStart, newCursorEnd);
        }, 0);
    };

    const toolbarButtons = [
        {
            title: '太字',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>,
            action: () => insertText('**', '**')
        },
        {
            title: '斜体',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>,
            action: () => insertText('*', '*')
        },
        {
            title: '打ち消し',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="M16 6l-10 12" /></svg>,
            action: () => insertText('~~', '~~')
        },
        {
            title: '見出し',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="M4 18V6" /><path d="M20 18V6" /></svg>,
            action: () => insertText('### ')
        },
        {
            title: '引用',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1 0 2.5 0 5-2 7zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c1.054 0 1.054 0 1.054 1 0 2.5-.054 5-2.054 7z" /></svg>,
            action: () => insertText('> ')
        },
        {
            title: 'コード',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
            action: () => insertText('```\n', '\n```')
        },
        {
            title: 'リンク',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
            action: () => insertText('[', '](url)')
        },
        {
            title: '箇条書き',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
            action: () => insertText('- ')
        },
        {
            title: '番号付きリスト',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>,
            action: () => insertText('1. ')
        },
        {
            title: 'Mermaid (図表)',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 12V8" /><path d="M11 15V8" /><path d="M15 11V8" /><path d="M19 18V8" /></svg>,
            action: () => insertText('```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n    B-->D;\n    C-->D;\n```\n')
        },
        {
            title: 'テーブル (表)',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="12" y1="3" x2="12" y2="21" /></svg>,
            action: () => insertText('| Header | Header |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |\n')
        },
    ];

    return (
        <div className={`border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 bg-white ${className}`}>
            <div className="bg-gray-50 border-b flex items-center justify-between">
                <div className="flex border-r border-gray-200">
                    <button
                        type="button"
                        onClick={() => setActiveTab('edit')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'edit'
                            ? 'bg-white border-b-2 border-sky-500 text-sky-600'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        編集
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'preview'
                            ? 'bg-white border-b-2 border-sky-500 text-sky-600'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        プレビュー
                    </button>
                </div>
                <div className="px-2 py-1 flex flex-wrap gap-0.5">
                    {toolbarButtons.map((btn, idx) => (
                        <button
                            key={idx}
                            type="button"
                            disabled={activeTab === 'preview'}
                            onClick={btn.action}
                            title={btn.title}
                            className={`p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded transition-colors flex items-center justify-center ${activeTab === 'preview' ? 'opacity-30 cursor-not-allowed' : ''
                                }`}
                        >
                            {btn.icon}
                        </button>
                    ))}
                </div>
            </div>
            {activeTab === 'edit' ? (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={rows}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 font-mono text-sm focus:outline-none border-none resize-y block leading-relaxed min-h-[200px]"
                />
            ) : (
                <div className="p-4 bg-slate-50 min-h-[200px] overflow-auto prose prose-sm max-w-none">
                    <MarkdownRenderer content={value || '*プレビューする内容がありません*'} />
                </div>
            )}
        </div>
    );
};

export default MarkdownEditor;
