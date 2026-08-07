import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';
import Portal from './Portal';

export interface ComboboxOption {
    value: string | number;
    label: string;
    /** ある場合、選択肢を2段表示し、この文字列を上段（グレー・小さめ）に出す */
    secondaryLabel?: string;
    /** trueの場合、この選択肢の下に区切り線を表示する */
    divider?: boolean;
    /** trueの場合、選択不可のグループ見出しとして表示する */
    isGroupLabel?: boolean;
    /** trueの場合、選択可能なグループ見出しとして表示する（直下の通常選択肢はインデント） */
    isGroupHeader?: boolean;
    /** 階層インデント（0=ルート）。グループツリー表示用 */
    depth?: number;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string | number | (string | number)[];
    onChange: (value: any) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    isMulti?: boolean;
    isSearchable?: boolean;
    showFloatingLabel?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export default function Combobox({
    options,
    value,
    onChange,
    label,
    placeholder = '',
    disabled = false,
    className = '',
    isMulti = false,
    isSearchable = true,
    showFloatingLabel = true,
    size = 'medium'
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const values = isMulti ? (Array.isArray(value) ? value : [value].filter(v => v !== '')) : [value];
    
    const selectedOptions = useMemo(() => {
        const seen = new Set<string>();
        const result: ComboboxOption[] = [];
        for (const o of options) {
            if (o.isGroupLabel) continue;
            const key = String(o.value);
            if (!values.some(v => String(v) === key)) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(o);
        }
        return result;
    }, [options, values]);

    const filteredOptions = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return options;

        const result: ComboboxOption[] = [];
        const pushed = new Set<number>(); // options 上の index
        const pushUnique = (idx: number) => {
            if (pushed.has(idx)) return;
            pushed.add(idx);
            result.push(options[idx]);
        };
        const pushAncestors = (idx: number) => {
            let depthLimit = options[idx].depth ?? 0;
            const ancestors: number[] = [];
            for (let j = idx - 1; j >= 0; j -= 1) {
                const prev = options[j];
                if (!prev.isGroupHeader && !prev.isGroupLabel) continue;
                const d = prev.depth ?? 0;
                if (d < depthLimit) {
                    ancestors.unshift(j);
                    depthLimit = d;
                    if (d === 0) break;
                }
            }
            for (const a of ancestors) pushUnique(a);
        };

        let i = 0;
        while (i < options.length) {
            const o = options[i];
            if (o.isGroupLabel || o.isGroupHeader) {
                const headerMatch = (o.label || '').toLowerCase().includes(q);
                if (headerMatch) {
                    const headerDepth = o.depth ?? 0;
                    pushAncestors(i);
                    pushUnique(i);
                    i += 1;
                    while (i < options.length) {
                        const next = options[i];
                        const nextDepth = next.depth ?? 0;
                        if (
                            (next.isGroupLabel || next.isGroupHeader) &&
                            nextDepth <= headerDepth
                        ) {
                            break;
                        }
                        pushUnique(i);
                        i += 1;
                    }
                    continue;
                }
                i += 1;
                continue;
            }
            const match =
                (o.label || '').toLowerCase().includes(q) ||
                (o.secondaryLabel || '').toLowerCase().includes(q);
            if (match) {
                pushAncestors(i);
                pushUnique(i);
            }
            i += 1;
        }
        return result;
    }, [options, search]);

    const updatePosition = () => {
        if (containerRef.current && isOpen) {
            const rect = containerRef.current.getBoundingClientRect();
            const GAP = 4;
            // 検索欄 + リスト(max-h-60=240px) のおよその高さ
            const searchHeight = isSearchable ? 52 : 0;
            const listMax = 240;
            const estimatedHeight = searchHeight + listMax;
            const spaceBelow = window.innerHeight - rect.bottom - GAP;
            const spaceAbove = rect.top - GAP;
            const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
            const available = Math.max(openUp ? spaceAbove : spaceBelow, 120);
            const maxDropdownHeight = Math.min(estimatedHeight, available);

            // position: fixed はビューポート基準のため scrollY/scrollX は加えない
            const style: React.CSSProperties = {
                position: 'fixed',
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 9999,
                maxHeight: `${maxDropdownHeight}px`,
            };
            if (openUp) {
                style.bottom = `${window.innerHeight - rect.top + GAP}px`;
            } else {
                style.top = `${rect.bottom + GAP}px`;
            }
            setDropdownStyle(style);
        }
    };

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
        if (option.isGroupLabel) return;
        if (isMulti) {
            const isSelected = values.some(v => String(v) === String(option.value));
            if (isSelected) {
                onChange(values.filter(v => String(v) !== String(option.value)));
            } else {
                onChange([...values, option.value]);
            }
        } else {
            onChange(String(option.value));
            setIsOpen(false);
            setIsFocused(false);
            setSearch('');
            inputRef.current?.blur();
        }
    };

    const handleInputFocus = () => {
        if (disabled) return;
        setIsFocused(true);
        setIsOpen(true);
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

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isMulti) {
            onChange([]);
        } else {
            onChange('');
        }
        setSearch('');
    };

    // Size styles
    const sizeClasses = {
        small: 'px-2 py-1 text-xs min-h-[32px]',
        medium: 'px-3 py-2 text-sm min-h-[42px]',
        large: 'px-4 py-3 text-base min-h-[52px]'
    };

    const isFloating = useMemo(() => {
        if (isFocused) return true;
        if (isMulti) return selectedOptions.length > 0;
        // Float only if we have a selected option that isn't the empty value
        return selectedOptions.length > 0 && selectedOptions[0].value !== '';
    }, [isFocused, isMulti, selectedOptions]);

    const floatingLabelClasses = {
        small: isFloating ? '-top-2 text-[10px] bg-white px-1 left-2' : 'top-1.5 text-xs left-3',
        medium: isFloating ? '-top-2.5 text-xs bg-white px-1 left-2.5' : 'top-2.5 text-base left-3',
        large: isFloating ? '-top-3 text-sm bg-white px-1 left-3' : 'top-3.5 text-lg left-4'
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

    const displayText = useMemo(() => {
        if (isMulti) {
            return selectedOptions
                .map((o) => (o.secondaryLabel ? `${o.secondaryLabel} / ${o.label}` : o.label))
                .join(', ');
        }
        const selected = selectedOptions[0];
        // If the value is empty, display nothing in the input
        if (!selected || selected.value === '') return '';
        return selected.secondaryLabel
            ? `${selected.secondaryLabel} / ${selected.label}`
            : selected.label;
    }, [isMulti, selectedOptions]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className={`relative w-full border rounded-md transition-all bg-white ${
                disabled ? 'bg-gray-50' : 'hover:border-gray-400'
            } ${isFocused ? 'ring-2 ring-sky-500 border-sky-500' : 'border-gray-300'}`}>
                
                <input
                    ref={inputRef}
                    type="text"
                    readOnly={isMulti || isSearchable} // Avoid dual-input confusion when searchable
                    value={isFocused && !isMulti && !isSearchable ? search : displayText}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={handleInputFocus}
                    onClick={handleInputFocus}
                    disabled={disabled}
                    placeholder={showFloatingLabel ? " " : placeholder}
                    className={`peer w-full bg-transparent focus:outline-none placeholder-gray-400 ${
                        disabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-900 cursor-text'
                    } ${sizeClasses[size]} ${showFloatingLabel ? inputPaddingClasses[size] : ''}`}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setIsOpen(false);
                            setIsFocused(false);
                            inputRef.current?.blur();
                        }
                        if (e.key === 'Enter' && filteredOptions.length > 0 && isOpen) {
                            handleSelect(filteredOptions[0]);
                        }
                    }}
                />

                {label && showFloatingLabel && (
                    <label className={`absolute transition-all pointer-events-none text-gray-400 ${
                        isFocused || isOpen || selectedOptions.length > 0
                        ? floatingLabelClasses[size] + ' ' + (isFocused ? 'text-sky-600' : 'text-gray-500')
                        : floatingLabelClasses[size]
                    }`}>
                        {label}
                    </label>
                )}

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {values.some(v => v !== '') && !disabled && (
                        <button type="button" onClick={handleClear} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleChevronClick}
                        className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${
                            size === 'small' ? 'w-3 h-3' : 'w-4 h-4'
                        }`} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <Portal>
                    <div
                        ref={dropdownRef}
                        style={dropdownStyle}
                        className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden animate-in fade-in duration-100 z-[9999] flex flex-col"
                    >
                        {isSearchable && (
                            <div className="p-2 border-b bg-gray-50 flex items-center gap-2 flex-shrink-0">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="検索..."
                                        className="w-full border rounded-md px-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    />
                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Search className="w-4 h-4" />
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
                        )}
                        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option, index) => {
                                    if (option.isGroupLabel) {
                                        const labelDepth = option.depth ?? 0;
                                        return (
                                            <li
                                                key={`label-${option.value}-${index}`}
                                                className="pt-2.5 pb-1 text-xs font-semibold text-slate-500 select-none"
                                                style={{ paddingLeft: 12 + labelDepth * 12, paddingRight: 12 }}
                                            >
                                                {option.label}
                                            </li>
                                        );
                                    }
                                    const isSelected = values.some(v => String(v) === String(option.value));
                                    let depth = option.depth;
                                    if (depth == null) {
                                        let indented = false;
                                        if (!option.isGroupHeader) {
                                            for (let j = index - 1; j >= 0; j--) {
                                                const prev = filteredOptions[j];
                                                if (prev.isGroupHeader || prev.isGroupLabel) {
                                                    indented = true;
                                                    break;
                                                }
                                            }
                                        }
                                        depth = option.isGroupHeader ? 0 : indented ? 1 : 0;
                                    }
                                    return (
                                        <li
                                            key={`${String(option.value)}-${index}`}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelect(option)}
                                            className={`group py-2 text-sm cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                                                option.divider ? 'border-b border-gray-200' : ''
                                            } ${
                                                option.isGroupHeader
                                                    ? 'pt-2.5 pb-1 text-xs font-semibold'
                                                    : ''
                                            } ${
                                                isSelected
                                                ? option.isGroupHeader
                                                    ? 'bg-sky-50 text-sky-700'
                                                    : 'bg-sky-50 text-sky-700 font-medium'
                                                : option.isGroupHeader
                                                  ? 'text-slate-600 hover:bg-sky-50'
                                                  : 'text-gray-700 hover:bg-sky-50'
                                            }`}
                                            style={{ paddingLeft: 12 + depth * 12, paddingRight: 12 }}
                                        >
                                            <div className="min-w-0 flex-1">
                                                {option.secondaryLabel && (
                                                    <div className={`text-xs truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-clip ${
                                                        isSelected ? 'text-sky-600/70 font-normal' : 'text-gray-500 font-normal'
                                                    }`}>
                                                        {option.secondaryLabel}
                                                    </div>
                                                )}
                                                <div className="truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-clip">
                                                    {option.label}
                                                </div>
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 flex-shrink-0 self-start mt-0.5" />}
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
