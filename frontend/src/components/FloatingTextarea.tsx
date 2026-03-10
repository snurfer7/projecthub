import { TextareaHTMLAttributes } from 'react';

interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
}

export default function FloatingTextarea({ label, error, className = '', id, placeholder, ...props }: FloatingTextareaProps) {
    const textareaId = id || label;

    return (
        <div className="relative">
            <textarea
                {...props}
                id={textareaId}
                placeholder=" "
                className={`peer w-full border rounded-md px-3 pt-5 pb-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder-transparent ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    } ${className}`}
            />
            <label
                htmlFor={textareaId}
                className={`absolute left-3 top-1.5 text-xs text-gray-500 transition-all 
                peer-placeholder-shown:text-base peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400
                peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-sky-600
                pointer-events-none`}
            >
                {label}
            </label>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
