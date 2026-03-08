import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface AnalogTimePickerProps {
    value: string; // HH:mm Format
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
}

export default function AnalogTimePicker({ value, onChange, disabled, className = '' }: AnalogTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
    const [tempTime, setTempTime] = useState(value || '00:00');
    const popoverRef = useRef<HTMLDivElement>(null);

    // Update internal state if value prop changes
    useEffect(() => {
        if (value) {
            setTempTime(value);
        }
    }, [value]);

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleOpen = () => {
        if (disabled) return;
        setTempTime(value || '00:00');
        setMode('hours');
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSave = () => {
        onChange(tempTime);
        setIsOpen(false);
    };

    const handleTimeSelect = (val: number, isHour: boolean) => {
        const [h, m] = tempTime.split(':');
        if (isHour) {
            const formattedH = String(val).padStart(2, '0');
            setTempTime(`${formattedH}:${m || '00'}`);
            setMode('minutes'); // Auto switch to minutes
        } else {
            const formattedM = String(val).padStart(2, '0');
            setTempTime(`${h || '00'}:${formattedM}`);
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

    // Clock dimension settings
    const R = 100; // Clock radius
    const cx = R;
    const cy = R;

    // Generate Hour Markers (Outer = 0-11 or AM, Inner = 12-23 or PM)
    // Actually standard 24h clock: Outer=0,1..11,12..23 is tricky. Usually 1-12 outer, 13-00 inner
    const hoursOuter = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const hoursInner = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    const getHandStyle = (value: number, isHour: boolean) => {
        let degrees = 0;
        let scale = 1;
        if (isHour) {
            degrees = (value % 12) * 30; // 360 / 12
            if (value === 0 || value > 12) {
                scale = 0.7; // Inner circle
            }
        } else {
            degrees = value * 6; // 360 / 60
        }
        return {
            transform: `rotate(${degrees}deg) scaleY(${scale})`,
            transformOrigin: 'bottom center',
        };
    };

    // Calculate position for numbers around circle
    const getPosList = (values: number[], radiusStr: number) => {
        return values.map((val, i) => {
            const angle = (i * 30) * (Math.PI / 180); // 30 degrees per tick
            // Subtract PI/2 so 0 is at top
            const x = cx + radiusStr * Math.cos(angle - Math.PI / 2);
            const y = cy + radiusStr * Math.sin(angle - Math.PI / 2);
            return { val, x, y };
        });
    };

    const outerHourPositions = getPosList(hoursOuter, 80);
    const innerHourPositions = getPosList(hoursInner, 50);
    const minutePositions = getPosList(minutes, 80);

    return (
        <div className="relative inline-block w-full">
            <div
                className={`flex items-center gap-2 border rounded-md px-3 py-2 bg-white cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-sky-400'} ${className}`}
                onClick={handleOpen}
            >
                <Clock className="w-4 h-4 text-gray-500" />
                <span className={`flex-1 text-sm ${!value && 'text-gray-400'}`}>
                    {value || '--:--'}
                </span>
            </div>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 mt-1 bg-white border rounded-lg shadow-xl p-4 w-64 animate-drop-in drop-shadow-lg"
                    style={{ left: 0, top: '100%' }}
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
                        {/* Center Dot */}
                        <div className="absolute w-2 h-2 bg-sky-500 rounded-full z-10"></div>

                        {/* Hand */}
                        <div
                            className="absolute bottom-1/2 left-1/2 w-1 bg-sky-400 origin-bottom rounded-full transition-transform duration-300 ease-in-out pointer-events-none"
                            style={{
                                height: 80, // matched roughly to max radius
                                marginLeft: -2,
                                ...getHandStyle(mode === 'hours' ? h : m, mode === 'hours')
                            }}
                        >
                            <div className="absolute -top-3 -left-3 w-7 h-7 bg-sky-400/30 rounded-full border border-sky-500 flex items-center justify-center">
                                {/* Small dot at tip */}
                                <div className="w-1.5 h-1.5 bg-sky-500 rounded-full"></div>
                            </div>
                        </div>

                        {/* Numbers */}
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

                        {/* Minute precise selection layer (invisible but clickable for any minute) -> Optional for exact 1m precision 
                            For simplicity we'll just snap to 5 min intervals or allow manual clicking on exact degrees.
                            Let's keep it simple with just 5 min snaps for mouse, same as provided map.
                        */}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                            onClick={handleClose}
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            className="px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                            onClick={handleSave}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

