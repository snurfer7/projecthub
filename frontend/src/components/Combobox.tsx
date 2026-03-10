import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import Portal from './Portal';

export interface ComboboxOption {
    id: string | number;
    name: string;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string | number;
    onChange: (id: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export default function Combobox({
    options,
    value,
    onChange,
    label,
    placeholder = '選択してください...',
    disabled = false,
    className = ''
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const selectedOption = options.find((o) => String(o.id) === String(value));
    const filteredOptions = options.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase())
    );

    const updatePosition = () => {
        if (containerRef.current && isOpen) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: `${rect.bottom + window.scrollY}px`,
                left: `${rect.left + window.scrollX}px`,
                width: `${rect.width}px`,
                zIndex: 9999,
            });
        }
    };

    // Use useLayoutEffect for smoother positioning updates before paint
    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current && !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setIsFocused(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option: ComboboxOption) => {
        onChange(String(option.id));
        setIsOpen(false);
        setIsFocused(false);
        setSearch('');
    };

    const handleInputFocus = () => {
        if (disabled) return;
        setIsFocused(true);
        setIsOpen(true);
        setSearch('');
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        if (isOpen) {
            setIsOpen(false);
            setIsFocused(false);
        } else {
            inputRef.current?.focus();
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className={`relative w-full border rounded-md transition-all bg-white ${disabled ? 'bg-gray-50' : 'hover:border-gray-400'
                } ${isFocused ? 'ring-2 ring-sky-500 border-sky-500' : 'border-gray-300'}`}>
                <input
                    ref={inputRef}
                    type="text"
                    value={isFocused || isOpen ? search : (selectedOption?.name || '')}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={handleInputFocus}
                    disabled={disabled}
                    placeholder={label ? " " : placeholder}
                    className={`peer w-full bg-transparent px-3 ${label ? 'pt-5 pb-2' : 'py-2'
                        } focus:outline-none placeholder-transparent ${disabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-900'
                        }`}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setIsOpen(false);
                            setIsFocused(false);
                            inputRef.current?.blur();
                        }
                        if (e.key === 'Enter' && filteredOptions.length > 0) {
                            handleSelect(filteredOptions[0]);
                        }
                    }}
                />

                {label && (
                    <label className={`absolute left-3 transition-all pointer-events-none ${isFocused || isOpen || !!selectedOption
                        ? 'top-1.5 text-xs ' + (isFocused ? 'text-sky-600' : 'text-gray-500')
                        : 'top-3 text-base text-gray-400'
                        }`}>
                        {label}
                    </label>
                )}

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {search && isFocused && (
                        <button type="button" onClick={() => setSearch('')} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleChevronClick}
                        className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <Portal>
                    <div
                        ref={dropdownRef}
                        style={dropdownStyle}
                        className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
                    >
                        <ul className="max-h-60 overflow-y-auto py-1">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => (
                                    <li
                                        key={option.id}
                                        onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                                        onClick={() => handleSelect(option)}
                                        className={`px-3 py-2 text-sm cursor-pointer transition-colors ${String(option.id) === String(value)
                                            ? 'bg-sky-100 text-sky-700 font-medium'
                                            : 'text-gray-700 hover:bg-sky-50'
                                            }`}
                                    >
                                        {option.name}
                                    </li>
                                ))
                            ) : (
                                <li className="px-3 py-4 text-sm text-gray-500 text-center">一致する結果が見つかりません</li>
                            )}
                        </ul>
                    </div>
                </Portal>
            )}
        </div>
    );
}

