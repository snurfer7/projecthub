import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Portal from './Portal';

interface CustomDatePickerProps {
    value: string; // YYYY-MM-DD or YYYY-MM or YYYY
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    id?: string;
    className?: string;
    size?: 'small' | 'medium' | 'large';
    showFloatingLabel?: boolean;
    selectMode?: 'date' | 'month' | 'year'; // Add year selection mode
}

export default function CustomDatePicker({ 
    value, 
    onChange, 
    label, 
    placeholder = '年/月/日',
    disabled = false, 
    required = false,
    error,
    id,
    className = '',
    size = 'medium',
    showFloatingLabel = true,
    selectMode = 'date'
}: CustomDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    const actualPlaceholder = placeholder || (selectMode === 'year' ? '年' : selectMode === 'month' ? '年/月' : '年/月/日');

    // Update view date when prop changes
    useEffect(() => {
        if (value) {
            if (selectMode === 'year') {
                // For year mode, parse YYYY format
                const year = parseInt(value, 10);
                if (!isNaN(year)) {
                    setViewDate(new Date(year, 0, 1));
                }
            } else if (selectMode === 'month') {
                // For month mode, parse YYYY-MM format
                const parts = value.split('-');
                if (parts.length >= 2) {
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    if (!isNaN(year) && !isNaN(month)) {
                        setViewDate(new Date(year, month, 1));
                    }
                }
            } else {
                // For date mode, parse YYYY-MM-DD format
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    setViewDate(date);
                }
            }
        }
    }, [value]);

    const updatePosition = () => {
        if (containerRef.current && isOpen) {
            const rect = containerRef.current.getBoundingClientRect();
            const pickerHeight = selectMode === 'year' ? 320 : selectMode === 'month' ? 280 : 380; // Approximate height
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            let top: number;

            if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
                // Flip up
                top = rect.top + window.scrollY - pickerHeight - 4;
            } else {
                // Open down
                top = rect.bottom + window.scrollY + 4;
            }

            setDropdownStyle({
                position: 'absolute',
                top: `${top}px`,
                left: `${rect.left + window.scrollX}px`,
                width: `256px`, // w-64 equivalent
                zIndex: 9999,
            });
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
        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current && !containerRef.current.contains(event.target as Node) &&
                popoverRef.current && !popoverRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setIsFocused(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpen = () => {
        if (disabled) return;
        setIsOpen(true);
        setIsFocused(true);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setIsOpen(false);
        setIsFocused(false);
    };

    const handleDateSelect = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
        setIsOpen(false);
        setIsFocused(false);
    };

    const handleMonthSelect = (month: number) => {
        const year = viewDate.getFullYear();
        const monthStr = String(month).padStart(2, '0');
        onChange(`${year}-${monthStr}`);
        setIsOpen(false);
        setIsFocused(false);
    };

    const handleYearSelect = (year: number) => {
        onChange(`${year}`);
        setIsOpen(false);
        setIsFocused(false);
    };

    const changeMonth = (offset: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(viewDate.getMonth() + offset);
        setViewDate(newDate);
    };

    // Styling logic from Combobox.tsx / TextInput.tsx
    const sizeClasses = {
        small: 'px-2 py-1 text-xs min-h-[32px]',
        medium: 'px-3 py-2 text-sm min-h-[42px]',
        large: 'px-4 py-3 text-base min-h-[52px]'
    };

    const isFloating = useMemo(() => {
        if (isFocused) return true;
        return value !== '' && value !== undefined && value !== null;
    }, [isFocused, value]);

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

    const displayText = selectMode === 'year' 
        ? (value ? value : '')
        : selectMode === 'month'
        ? (value ? value.replace(/-/g, '/') : '')
        : (value ? value.replace(/-/g, '/') : '');

    // Calendar generation
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const days = [];
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(viewYear, viewMonth - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, currentMonth: true, date: new Date(viewYear, viewMonth, i) });
    }
    const totalRemaining = 42 - days.length;
    for (let i = 1; i <= totalRemaining; i++) {
        days.push({ day: i, currentMonth: false, date: new Date(viewYear, viewMonth + 1, i) });
    }

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    const isSelected = (date: Date) => {
        if (!value) return false;
        if (selectMode === 'year') {
            // Extract year from value (YYYY format)
            const year = parseInt(value, 10);
            return date.getFullYear() === year;
        } else if (selectMode === 'month') {
            // Extract year and month from value (YYYY-MM format)
            const parts = value.split('-');
            if (parts.length < 2) return false;
            return date.getFullYear() === parseInt(parts[0]) &&
                   date.getMonth() === parseInt(parts[1]) - 1;
        } else {
            // Original date selection logic
            const selected = new Date(value);
            return date.getDate() === selected.getDate() &&
                   date.getMonth() === selected.getMonth() &&
                   date.getFullYear() === selected.getFullYear();
        }
    };

    const wrapperClasses = `relative w-full border rounded-md transition-all bg-white ${
        disabled ? 'bg-gray-50' : 'hover:border-gray-400'
    } ${
        error 
        ? 'border-red-500 ring-2 ring-red-500' 
        : isFocused ? 'ring-2 ring-sky-500 border-sky-500' : 'border-gray-300'
    }`;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div 
                className={wrapperClasses}
                onClick={handleOpen}
            >
                <input
                    id={inputId}
                    type="text"
                    readOnly
                    value={displayText}
                    disabled={disabled}
                    required={required}
                    placeholder={showFloatingLabel ? " " : actualPlaceholder}
                    className={`peer w-full bg-transparent focus:outline-none placeholder-gray-400 ${
                        disabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-900 cursor-pointer'
                    } ${sizeClasses[size]} ${showFloatingLabel ? inputPaddingClasses[size] : ''}`}
                />

                {label && showFloatingLabel && (
                    <label 
                        htmlFor={inputId}
                        className={`absolute transition-all pointer-events-none text-gray-400 ${
                        isFocused || isOpen || (value && value !== '')
                        ? floatingLabelClasses[size] + ' ' + (error ? 'text-red-500' : isFocused ? 'text-sky-600' : 'text-gray-500')
                        : floatingLabelClasses[size]
                    }`}>
                        {label}{required ? ' *' : ''}
                    </label>
                )}

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value && !disabled && (
                        <button type="button" onClick={handleClear} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <CalendarIcon className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
                    </button>
                </div>
            </div>

            {label && !showFloatingLabel && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}{required ? ' *' : ''}
                </label>
            )}

            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

            {isOpen && (
                <Portal>
                    <div
                        ref={popoverRef}
                        style={dropdownStyle}
                        className="bg-white border border-gray-200 rounded-lg shadow-xl w-64 animate-in fade-in zoom-in-95 overflow-hidden drop-shadow-2xl"
                    >
                        {selectMode === 'year' ? (
                            // Year Selection UI
                            <>
                                <div className="bg-sky-500 p-4 text-white">
                                    <div className="text-xs font-medium opacity-80 mb-1">年を選択</div>
                                    <div className="text-xl font-semibold">{viewYear}年</div>
                                </div>

                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-4 px-1">
                                        <span className="text-sm font-bold text-slate-800">
                                            {viewYear - 4}年 ～ {viewYear + 5}年
                                        </span>
                                        <div className="flex items-center">
                                            <button type="button" onClick={() => setViewDate(new Date(viewYear - 10, 0))} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button type="button" onClick={() => setViewDate(new Date(viewYear + 10, 0))} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {Array.from({ length: 10 }, (_, i) => {
                                            const year = viewYear - 4 + i;
                                            const isYearSelected = isSelected(new Date(year, 0, 1));
                                            return (
                                                <button
                                                    type="button"
                                                    key={i}
                                                    onClick={() => handleYearSelect(year)}
                                                    className={`
                                                        h-10 rounded-md flex items-center justify-center text-sm font-medium transition-all
                                                        ${isYearSelected 
                                                            ? 'bg-sky-500 text-white hover:bg-sky-600 shadow-md' 
                                                            : 'text-slate-700 hover:bg-sky-50 hover:text-sky-600'
                                                        }
                                                    `}
                                                >
                                                    {year}年
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-2 flex justify-between gap-2 border-t text-right">
                                    <button
                                        type="button"
                                        onClick={() => handleYearSelect(new Date().getFullYear())}
                                        className="px-3 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 rounded transition-colors"
                                    >
                                        当年
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 rounded transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        ) : selectMode === 'month' ? (
                            // Month Selection UI
                            <>
                                <div className="bg-sky-500 p-4 text-white">
                                    <div className="text-xs font-medium opacity-80 mb-1">年を選択</div>
                                    <div className="text-xl font-semibold">{viewYear}年</div>
                                </div>

                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-4 px-1">
                                        <span className="text-sm font-bold text-slate-800">
                                            {viewYear}年
                                        </span>
                                        <div className="flex items-center">
                                            <button type="button" onClick={() => setViewDate(new Date(viewYear - 1, 0))} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button type="button" onClick={() => setViewDate(new Date(viewYear + 1, 0))} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const month = i + 1;
                                            const isMonthSelected = isSelected(new Date(viewYear, i, 1));
                                            return (
                                                <button
                                                    type="button"
                                                    key={i}
                                                    onClick={() => handleMonthSelect(month)}
                                                    className={`
                                                        h-10 rounded-md flex items-center justify-center text-sm font-medium transition-all
                                                        ${isMonthSelected 
                                                            ? 'bg-sky-500 text-white hover:bg-sky-600 shadow-md' 
                                                            : 'text-slate-700 hover:bg-sky-50 hover:text-sky-600'
                                                        }
                                                    `}
                                                >
                                                    {month}月
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-2 flex justify-between gap-2 border-t text-right">
                                    <button
                                        type="button"
                                        onClick={() => handleMonthSelect(new Date().getMonth() + 1)}
                                        className="px-3 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 rounded transition-colors"
                                    >
                                        当月
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 rounded transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        ) : (
                            // Date Selection UI (existing calendar)
                            <>
                                <div className="bg-sky-500 p-4 text-white">
                                    <div className="text-xs font-medium opacity-80 mb-1">{viewYear}年</div>
                                    <div className="text-xl font-semibold leading-tight">
                                        {viewMonth + 1}月{value && isSelected(new Date(value)) ? new Date(value).getDate() + '日' : ''}
                                    </div>
                                </div>

                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-4 px-1">
                                        <span className="text-sm font-bold text-slate-800">
                                            {viewYear}年 {viewMonth + 1}月
                                        </span>
                                        <div className="flex items-center">
                                            <button type="button" onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button type="button" onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                        {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                                            <div key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{d}</div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 text-center">
                                        {days.map((d, i) => (
                                            <button
                                                type="button"
                                                key={i}
                                                onClick={() => handleDateSelect(d.date)}
                                                className={`
                                                    h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all
                                                    ${!d.currentMonth ? 'text-gray-300' : 'text-slate-700 hover:bg-sky-50 hover:text-sky-600'}
                                                    ${isSelected(d.date) ? 'bg-sky-500 text-white hover:bg-sky-600 hover:text-white transform scale-110 shadow-md font-bold' : ''}
                                                    ${isToday(d.date) && !isSelected(d.date) ? 'border border-sky-500 text-sky-600' : ''}
                                                `}
                                            >
                                                {d.day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-2 flex justify-between gap-2 border-t text-right">
                                    <button
                                        type="button"
                                        onClick={() => handleDateSelect(new Date())}
                                        className="px-3 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 rounded transition-colors"
                                    >
                                        当日
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 rounded transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </Portal>
            )}
        </div>
    );
}
