import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Mermaid from './Mermaid';

interface MarkdownRendererProps {
    content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                table: ({ children }) => (
                    <div className="overflow-x-auto mb-6 rounded-lg border border-slate-300 shadow-sm">
                        <table className="w-full border-collapse bg-white text-sm border border-slate-300">
                            {children}
                        </table>
                    </div>
                ),
                thead: ({ children }) => <thead className="bg-slate-100 border-b-2 border-slate-300">{children}</thead>,
                th: ({ children }) => <th className="px-4 py-3 text-left font-bold text-slate-900 border border-slate-300">{children}</th>,
                td: ({ children }) => <td className="px-4 py-2.5 text-slate-700 border border-slate-200">{children}</td>,
                tr: ({ children }) => <tr className="hover:bg-slate-50 transition-colors">{children}</tr>,
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-slate-800">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mb-3 text-slate-800">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-bold mb-2 text-slate-800">{children}</h3>,
                p: ({ children }) => <p className="text-slate-700 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-4 text-slate-700 space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-4 text-slate-700 space-y-2">{children}</ol>,
                li: ({ children }) => <li className="ml-4">{children}</li>,
                a: ({ href, children }) => (
                    <a href={href} className="text-sky-600 hover:text-sky-700 underline">
                        {children}
                    </a>
                ),
                strong: ({ children }) => <strong className="font-bold text-slate-800">{children}</strong>,
                em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
                blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-slate-400 pl-4 italic text-slate-600 my-4">
                        {children}
                    </blockquote>
                ),
                hr: () => <hr className="my-6 border-slate-300" />,
                code: ({ className, children }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match && match[1] === 'mermaid') {
                        return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                    }
                    const isInline = !className;
                    return isInline ? (
                        <code className="bg-slate-200 px-2 py-1 rounded text-sm font-mono">{children}</code>
                    ) : (
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded mb-4 overflow-auto">
                            <code className={`font-mono text-sm ${className}`}>{children}</code>
                        </pre>
                    );
                },
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

export default MarkdownRenderer;
