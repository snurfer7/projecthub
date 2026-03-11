import { InputHTMLAttributes, ReactNode } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
    label?: string;
    error?: string;
    showFloatingLabel?: boolean;
    size?: 'small' | 'medium' | 'large';
    startAdornment?: ReactNode;
    endAdornment?: ReactNode;
}

export default function NumberInput(props: NumberInputProps) {
    const {
        label,
        error,
        showFloatingLabel = true,
        size = 'medium',
        className = '',
        id,
        placeholder,
        startAdornment,
        endAdornment,
        ...rest
    } = props;

    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    // Padding logic to account for adornments
    const paddingClasses = {
        small: `${startAdornment ? 'pr-2 pl-1.5' : 'px-2'} ${endAdornment ? '!pr-1.5' : ''}`,
        medium: `${startAdornment ? 'pr-3 pl-2' : 'px-3'} ${endAdornment ? '!pr-2' : ''}`,
        large: `${startAdornment ? 'pr-4 pl-2.5' : 'px-4'} ${endAdornment ? '!pr-2.5' : ''}`
    };

    // Size styles consistent with Combobox.tsx
    const sizeClasses = {
        small: `${paddingClasses.small} text-xs min-h-[32px]`,
        medium: `${paddingClasses.medium} text-sm min-h-[42px]`,
        large: `${paddingClasses.large} text-base min-h-[52px]`
    };

    // Label position classes for floating label
    const floatingLabelClasses = {
        small: `peer-placeholder-shown:text-xs peer-placeholder-shown:top-1.5 ${startAdornment ? 'peer-placeholder-shown:left-8' : 'peer-placeholder-shown:left-2.5'} peer-focus:-top-2 peer-focus:text-[10px] peer-focus:left-2 -top-2 text-[10px] left-2`,
        medium: `peer-placeholder-shown:text-base peer-placeholder-shown:top-2.5 ${startAdornment ? 'peer-placeholder-shown:left-9' : 'peer-placeholder-shown:left-3'} peer-focus:-top-2.5 peer-focus:text-xs peer-focus:left-2.5 -top-2.5 text-xs left-2.5`,
        large: `peer-placeholder-shown:text-lg peer-placeholder-shown:top-3.5 ${startAdornment ? 'peer-placeholder-shown:left-10' : 'peer-placeholder-shown:left-4'} peer-focus:-top-3 peer-focus:text-sm peer-focus:left-3 -top-3 text-sm left-3`
    };

    const inputPaddingClasses = showFloatingLabel ? {
        small: 'py-1.5',
        medium: 'py-2.5',
        large: 'py-3.5'
    } : {
        small: 'py-1',
        medium: 'py-2',
        large: 'py-3'
    };

    const wrapperClasses = `relative w-full border rounded-md transition-all flex items-center ${
        props.disabled ? 'bg-gray-50' : 'bg-white hover:border-gray-400'
    } ${
        error 
        ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500' 
        : 'border-gray-300 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500'
    }`;

    // Apply placeholder-transparent to hide actual placeholder until focused, if floating label is used
    const placeholderVisibilityClass = showFloatingLabel && placeholder 
        ? 'placeholder-transparent focus:placeholder-gray-400' 
        : 'placeholder-gray-400';

    const inputClasses = `peer w-full bg-transparent border-none text-gray-900 focus:outline-none flex-grow ${
        sizeClasses[size]
    } ${showFloatingLabel ? inputPaddingClasses[size] : ''} ${
        props.disabled ? 'cursor-not-allowed text-gray-400' : ''
    } ${placeholderVisibilityClass}`;

    const renderInput = () => {
        const commonProps = {
            id: inputId,
            placeholder: placeholder || (showFloatingLabel ? " " : undefined),
            className: inputClasses,
        };

        return (
            <input
                type="number"
                {...rest}
                {...commonProps}
            />
        );
    };

    const adornmentContainerClasses = "flex items-center justify-center text-gray-500 whitespace-nowrap shrink-0";

    return (
        <div className={`relative group ${className}`}>
            <div className={wrapperClasses}>
                {startAdornment && (
                    <div className={`${adornmentContainerClasses} pl-3 pr-1`}>
                        {startAdornment}
                    </div>
                )}
                
                {renderInput()}
                
                {endAdornment && (
                    <div className={`${adornmentContainerClasses} pr-3 pl-1`}>
                        {endAdornment}
                    </div>
                )}
                
                {label && showFloatingLabel && (
                    <label
                        htmlFor={inputId}
                        className={`absolute bg-white px-1 text-gray-500 transition-all pointer-events-none
                        peer-placeholder-shown:bg-transparent peer-placeholder-shown:px-0 peer-placeholder-shown:text-gray-400 
                        peer-focus:bg-white peer-focus:px-1 peer-focus:text-sky-600 
                        ${floatingLabelClasses[size]}`}
                    >
                        {label}
                    </label>
                )}
            </div>
            
            {label && !showFloatingLabel && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}

            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
