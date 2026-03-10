import { SelectHTMLAttributes, ReactNode } from 'react';

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    children: ReactNode;
}

export default function FloatingSelect({ label, error, children, className = '', id, ...props }: FloatingSelectProps) {
    const selectId = id || label;

    return (
        <div className="relative">
            <select
                {...props}
                id={selectId}
                className={`peer w-full border rounded-md px-3 pt-5 pb-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    } ${className}`}
            >
                {children}
            </select>
            <label
                htmlFor={selectId}
                className="absolute left-3 top-1.5 text-xs text-gray-500 transition-all peer-focus:text-sky-600 pointer-events-none"
            >
                {label}
            </label>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none pt-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
