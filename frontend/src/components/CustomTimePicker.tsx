import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Clock, X } from 'lucide-react';
import Portal from './Portal';

interface CustomTimePickerProps {
    value: string; // HH:mm
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
}

export default function CustomTimePicker({
    value,
    onChange,
    label,
    placeholder = '--:--',
    disabled = false,
    required = false,
    error,
    id,
    className = '',
    size = 'medium',
    showFloatingLabel = true
}: CustomTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
    const [tempTime, setTempTime] = useState(value || '00:00');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    useEffect(() => {
        if (value) {
            setTempTime(value);
        }
    }, [value]);

    const updatePosition = () => {
        if (containerRef.current && isOpen) {
            const rect = containerRef.current.getBoundingClientRect();
            const pickerHeight = 350; // Approximate height
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            let top: number;
            if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
                top = rect.top + window.scrollY - pickerHeight - 4;
            } else {
                top = rect.bottom + window.scrollY + 4;
            }

            setDropdownStyle({
                position: 'absolute',
                top: `${top}px`,
                left: `${rect.left + window.scrollX}px`,
                width: `256px`,
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
        setTempTime(value || '00:00');
        setMode('hours');
        setIsOpen(true);
        setIsFocused(true);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setIsOpen(false);
        setIsFocused(false);
    };

    const handleTimeSelect = (val: number, isHour: boolean) => {
        const [h, m] = tempTime.split(':');
        if (isHour) {
            const formattedH = String(val).padStart(2, '0');
            setTempTime(`${formattedH}:${m || '00'}`);
            setMode('minutes');
        } else {
            const formattedM = String(val).padStart(2, '0');
            const newTime = `${h || '00'}:${formattedM}`;
            setTempTime(newTime);
            onChange(newTime);
            setIsOpen(false);
            setIsFocused(false);
        }
    };

    const parseTime = (timeStr: string) => {
        const parts = timeStr.split(':');
        return {
            h: parseInt(parts[0], 10) || 0,
            m: parseInt(parts[1], 10) || 0
        };
    };

    const { h, m } = parseTime(tempTime);

    // Clock Face Logic
    const hoursOuter = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const hoursInner = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    const getHandStyle = (v: number, isHour: boolean) => {
        let degrees = 0;
        let scale = 1;
        if (isHour) {
            degrees = (v % 12) * 30;
            if (v === 0 || v > 12) scale = 0.7;
        } else {
            degrees = v * 6;
        }
        return {
            transform: `rotate(${degrees}deg) scaleY(${scale})`,
            transformOrigin: 'bottom center',
        };
    };

    const getPosList = (values: number[], radius: number) => {
        return values.map((val, i) => {
            const angle = (i * 30) * (Math.PI / 180);
            const x = 100 + radius * Math.cos(angle - Math.PI / 2);
            const y = 100 + radius * Math.sin(angle - Math.PI / 2);
            return { val, x, y };
        });
    };

    const outerHourPositions = getPosList(hoursOuter, 80);
    const innerHourPositions = getPosList(hoursInner, 50);
    const minutePositions = getPosList(minutes, 80);

    // Styles
    const sizeClasses = {
        small: 'px-2 py-1 text-xs min-h-[32px]',
        medium: 'px-3 py-2 text-sm min-h-[42px]',
        large: 'px-4 py-3 text-base min-h-[52px]'
    };

    const isFloating = useMemo(() => {
        if (isFocused || isOpen) return true;
        return value !== '' && value !== undefined && value !== null;
    }, [isFocused, isOpen, value]);

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

    const wrapperClasses = `relative w-full border rounded-md transition-all bg-white ${disabled ? 'bg-gray-50' : 'hover:border-gray-400'
        } ${error ? 'border-red-500 ring-2 ring-red-500' : isFocused ? 'ring-2 ring-sky-500 border-sky-500' : 'border-gray-300'
        }`;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className={wrapperClasses} onClick={handleOpen}>
                <input
                    id={inputId}
                    type="text"
                    readOnly
                    value={value || ''}
                    disabled={disabled}
                    required={required}
                    placeholder={showFloatingLabel ? " " : placeholder}
                    className={`peer w-full bg-transparent focus:outline-none placeholder-gray-400 ${disabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-900 cursor-pointer'
                        } ${sizeClasses[size]} ${showFloatingLabel ? inputPaddingClasses[size] : ''}`}
                />

                {label && showFloatingLabel && (
                    <label
                        htmlFor={inputId}
                        className={`absolute transition-all pointer-events-none text-gray-400 ${isFocused || isOpen || (value && value !== '')
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
                    <button type="button" className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none">
                        <Clock className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
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
                        className="bg-white border border-gray-200 rounded-lg shadow-xl w-64 animate-in fade-in zoom-in-95 overflow-hidden drop-shadow-2xl p-4"
                    >
                        {/* Header showing selected time */}
                        <div className="flex justify-center items-center gap-2 mb-4 text-3xl font-light text-slate-800 bg-gray-50 p-3 rounded-lg">
                            <span
                                className={`cursor-pointer px-2 py-1 rounded-md transition-colors ${mode === 'hours' ? 'bg-sky-100 text-sky-700' : 'text-gray-500 hover:bg-gray-200'}`}
                                onClick={() => setMode('hours')}
                            >
                                {String(h).padStart(2, '0')}
                            </span>
                            <span className="text-gray-400 pb-1">:</span>
                            <span
                                className={`cursor-pointer px-2 py-1 rounded-md transition-colors ${mode === 'minutes' ? 'bg-sky-100 text-sky-700' : 'text-gray-500 hover:bg-gray-200'}`}
                                onClick={() => setMode('minutes')}
                            >
                                {String(m).padStart(2, '0')}
                            </span>
                        </div>

                        {/* Clock Face */}
                        <div className="relative mx-auto bg-gray-50 rounded-full flex justify-center items-center select-none" style={{ width: 200, height: 200 }}>
                            <div className="absolute w-2 h-2 bg-sky-500 rounded-full z-10"></div>
                            <div
                                className="absolute bottom-1/2 left-1/2 w-1 bg-sky-400 origin-bottom rounded-full transition-transform duration-300 ease-in-out pointer-events-none"
                                style={{
                                    height: 80,
                                    marginLeft: -2,
                                    ...getHandStyle(mode === 'hours' ? h : m, mode === 'hours')
                                }}
                            >
                                <div className="absolute -top-3 -left-3 w-7 h-7 bg-sky-400/30 rounded-full border border-sky-500 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full"></div>
                                </div>
                            </div>

                            {mode === 'hours' ? (
                                <>
                                    {outerHourPositions.map(({ val, x, y }) => (
                                        <button
                                            type="button"
                                            key={`h-outer-${val}`}
                                            className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-sm transition-colors
                                                ${h === val ? 'bg-sky-500 text-white' : 'text-slate-700 hover:bg-gray-200'}
                                            `}
                                            style={{ left: x, top: y }}
                                            onClick={() => handleTimeSelect(val, true)}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                    {innerHourPositions.map(({ val, x, y }) => (
                                        <button
                                            type="button"
                                            key={`h-inner-${val}`}
                                            className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs transition-colors
                                                ${h === val ? 'bg-sky-500 text-white' : 'text-gray-500 hover:bg-gray-200'}
                                            `}
                                            style={{ left: x, top: y }}
                                            onClick={() => handleTimeSelect(val, true)}
                                        >
                                            {val === 0 ? '00' : val}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                minutePositions.map(({ val, x, y }) => (
                                    <button
                                        type="button"
                                        key={`m-${val}`}
                                        className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-sm transition-colors
                                            ${m === val ? 'bg-sky-500 text-white' : 'text-slate-700 hover:bg-gray-200'}
                                        `}
                                        style={{ left: x, top: y }}
                                        onClick={() => handleTimeSelect(val, false)}
                                    >
                                        {String(val).padStart(2, '0')}
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                type="button"
                                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
