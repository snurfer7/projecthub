import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import Portal from './Portal';

export interface MultiComboboxOption {
    id: string | number;
    name: string;
}

interface MultiComboboxProps {
    options: MultiComboboxOption[];
    values: (string | number)[];
    onChange: (values: (string | number)[]) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export default function MultiCombobox({
    options,
    values,
    onChange,
    label,
    placeholder = '選択してください...',
    disabled = false,
    className = ''
}: MultiComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const selectedOptions = options.filter((o) =>
        values.some(v => String(v) === String(o.id))
    );

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

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
            // Autofocus search input when dropdown opens
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 0);
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

    const toggleOption = (option: MultiComboboxOption) => {
        const isSelected = values.some(v => String(v) === String(option.id));
        if (isSelected) {
            onChange(values.filter(v => String(v) !== String(option.id)));
        } else {
            onChange([...values, option.id]);
        }
        // Focus the search input after selection
        searchInputRef.current?.focus();
    };

    const removeOption = (e: React.MouseEvent, id: string | number) => {
        e.stopPropagation();
        onChange(values.filter(v => String(v) !== String(id)));
    };

    const handleInputFocus = () => {
        if (disabled) return;
        setIsFocused(true);
        setIsOpen(true);
    };

    const handleContainerClick = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
        setIsFocused(!isOpen);
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
        setSearch('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`relative w-full border rounded-md transition-all bg-white min-h-[38px] cursor-text flex flex-wrap items-center gap-1.5 p-1.5 ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-400'
                    } ${isFocused ? 'ring-2 ring-sky-500 border-sky-500' : 'border-gray-300'}`}
                onClick={handleContainerClick}
            >
                {selectedOptions.length > 0 ? (
                    <span className="text-sm text-gray-900 px-1 truncate flex-1">
                        {selectedOptions.map(o => o.name).join(', ')}
                    </span>
                ) : (
                    <span className="text-sm text-gray-400 px-1">{placeholder}</span>
                )}

                <div className="flex items-center gap-1 pr-1 ml-auto shrink-0 self-stretch">
                    {values.length > 0 && !disabled && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {label && (
                    <label className={`absolute left-3 transition-all pointer-events-none ${isFocused || isOpen || selectedOptions.length > 0
                        ? 'top-[-10px] left-2 px-1 bg-white text-xs ' + (isFocused ? 'text-sky-600' : 'text-gray-500')
                        : 'top-1/2 -translate-y-1/2 text-sm text-gray-400'
                        }`}>
                        {label}
                    </label>
                )}
            </div>

            {isOpen && (
                <Portal>
                    <div
                        ref={dropdownRef}
                        style={dropdownStyle}
                        className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col"
                    >
                        <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="検索..."
                                    className="w-full border rounded-md px-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setIsOpen(false);
                                            setIsFocused(false);
                                        }
                                        if (e.key === 'Enter' && filteredOptions.length > 0) {
                                            toggleOption(filteredOptions[0]);
                                        }
                                    }}
                                />
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <ul className="max-h-60 overflow-y-auto py-1">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => {
                                    const isSelected = values.some(v => String(v) === String(option.id));
                                    return (
                                        <li
                                            key={option.id}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => toggleOption(option)}
                                            className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${isSelected
                                                ? 'bg-sky-50 text-sky-700 font-medium'
                                                : 'text-gray-700 hover:bg-sky-50'
                                                }`}
                                        >
                                            {option.name}
                                            {isSelected && <Check className="w-4 h-4" />}
                                        </li>
                                    );
                                })
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
