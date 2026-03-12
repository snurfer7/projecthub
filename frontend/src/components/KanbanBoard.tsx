import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { Issue, IssueStatus } from '../types';

interface KanbanBoardProps {
    statuses: IssueStatus[];
    issues: Issue[];
    onDrop: (issueId: number, targetStatusId: number) => void;
    onNewIssue?: (statusId: number) => void;
    onIssueClick?: (issueId: number) => void;
    showProjectName?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
    '今すぐ': 'bg-red-100 text-red-700 border-red-200',
    '急いで': 'bg-red-100 text-red-700 border-red-200',
    '高め': 'bg-orange-100 text-orange-700 border-orange-200',
    '通常': 'bg-blue-100 text-blue-700 border-blue-200',
    '低い': 'bg-gray-100 text-gray-700 border-gray-200',
};

const TRACKER_COLORS: Record<string, string> = {
    'バグ': 'bg-red-500',
    'Bug': 'bg-red-500',
    '機能': 'bg-sky-500',
    'Feature': 'bg-sky-500',
    'サポート': 'bg-purple-500',
    'Support': 'bg-purple-500',
};

function getTrackerColor(name: string) {
    return TRACKER_COLORS[name] || 'bg-slate-400';
}

function getPriorityClass(name: string) {
    return PRIORITY_COLORS[name] || 'bg-gray-100 text-gray-600 border-gray-200';
}

const IssueCard = React.forwardRef<HTMLDivElement, {
    issue: Issue,
    showProjectName?: boolean,
    isDragging: boolean,
    onDragStart: () => void,
    onDragEnd: () => void,
    onMouseEnter: () => void,
    onMouseLeave: () => void,
    onIssueClick?: (issueId: number) => void;
}>(({ issue, showProjectName, isDragging, onDragStart, onDragEnd, onMouseEnter, onMouseLeave, onIssueClick }, ref) => {
    const assigneeName = issue.assignedToGroup
        ? issue.assignedToGroup.name
        : issue.assignedTo
            ? `${issue.assignedTo.lastName} ${issue.assignedTo.firstName}`
            : null;

    return (
        <div
            ref={ref}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`bg-white rounded-md shadow-sm border border-gray-200 p-3 mb-3 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-40 rotate-1 scale-95' : 'hover:shadow-md hover:-translate-y-1'
                }`}
        >
            <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getTrackerColor(issue.tracker?.name || '')}`} />
                <span className="text-xs font-medium text-gray-400 capitalize">{issue.tracker?.name} #{issue.id}</span>
            </div>

            <Link
                to={`/issues/${issue.id}`}
                className="text-sm font-semibold text-slate-800 hover:text-sky-600 leading-snug block mb-1 line-clamp-2"
                onClick={(e) => {
                    if (onIssueClick) {
                        e.preventDefault();
                        e.stopPropagation();
                        onIssueClick(issue.id);
                    } else {
                        e.stopPropagation();
                    }
                }}
            >
                {issue.subject}
            </Link>

            {showProjectName && issue.project && (
                <div className="text-[10px] text-gray-400 mb-2 truncate">{issue.project.name}</div>
            )}

            <div className="flex items-center justify-between mt-auto">
                {issue.priority && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider ${getPriorityClass(issue.priority.name)}`}>
                        {issue.priority.name}
                    </span>
                )}
                {assigneeName && (
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 ml-auto">
                        {issue.assignedToGroup && <Users className="w-3 h-3 text-indigo-400" />}
                        {assigneeName}
                    </span>
                )}
            </div>

            {issue.doneRatio > 0 && (
                <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                        className="bg-sky-400 h-1.5 rounded-full"
                        style={{ width: `${issue.doneRatio}%` }}
                    />
                </div>
            )}
        </div>
    );
});

IssueCard.displayName = 'IssueCard';

export default function KanbanBoard({ statuses, issues, onDrop, onNewIssue, onIssueClick, showProjectName }: KanbanBoardProps) {
    const [draggingIssueId, setDraggingIssueId] = useState<number | null>(null);
    const [dragOverStatusId, setDragOverStatusId] = useState<number | null>(null);
    const [hoveredIssueId, setHoveredIssueId] = useState<number | null>(null);
    const dragCounter = useRef<Record<number, number>>({});
    const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDragStart = (issueId: number) => {
        setDraggingIssueId(issueId);
        document.body.classList.add('grabbing-active');
    };

    const handleDragEnd = () => {
        setDraggingIssueId(null);
        setDragOverStatusId(null);
        dragCounter.current = {};
        document.body.classList.remove('grabbing-active');
    };

    const handleDragEnter = (statusId: number) => {
        dragCounter.current[statusId] = (dragCounter.current[statusId] || 0) + 1;
        setDragOverStatusId(statusId);
    };

    const handleDragLeave = (statusId: number) => {
        dragCounter.current[statusId] = (dragCounter.current[statusId] || 0) - 1;
        if (dragCounter.current[statusId] <= 0) {
            dragCounter.current[statusId] = 0;
            setDragOverStatusId((prev) => (prev === statusId ? null : prev));
        }
    };

    const handleDropInternal = (statusId: number) => {
        if (draggingIssueId !== null) {
            onDrop(draggingIssueId, statusId);
        }
        handleDragEnd();
    };

    const hoveredIssue = issues.find(i => i.id === hoveredIssueId);

    return (
        <div className="flex-1 overflow-x-auto bg-slate-50 relative custom-scrollbar">
            <div ref={containerRef} className="flex gap-6 h-full min-w-max relative" style={{ isolation: 'isolate' }}>
                {statuses.map((status) => {
                    const columnIssues = issues.filter((i) => i.statusId === status.id);
                    return (
                        <div
                            key={status.id}
                            className="w-80 flex flex-col h-full z-10"
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnter={() => handleDragEnter(status.id)}
                            onDragLeave={() => handleDragLeave(status.id)}
                            onDrop={() => handleDropInternal(status.id)}
                        >
                            <div className={`rounded-t-lg px-4 py-2.5 flex items-center justify-between flex-shrink-0 ${status.isClosed ? 'bg-gray-200' : 'bg-slate-700'}`}>
                                <span className={`font-semibold text-sm ${status.isClosed ? 'text-gray-600' : 'text-white'}`}>
                                    {status.name}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.isClosed ? 'bg-gray-300 text-gray-600' : 'bg-white/20 text-white'}`}>
                                        {columnIssues.length}
                                    </span>
                                    {onNewIssue && (
                                        <button
                                            onClick={() => onNewIssue(status.id)}
                                            className={`p-1 rounded transition-colors ${status.isClosed ? 'text-gray-500 hover:bg-gray-300' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div
                                className={`flex-1 rounded-b-lg p-2 overflow-y-auto transition-colors custom-scrollbar min-h-[200px] ${dragOverStatusId === status.id && draggingIssueId !== null
                                    ? 'bg-sky-50 border-2 border-sky-300 border-dashed'
                                    : 'bg-gray-100/50 border-2 border-transparent'
                                    }`}
                            >
                                {columnIssues.map((issue) => (
                                    <IssueCard
                                        key={issue.id}
                                        issue={issue}
                                        showProjectName={showProjectName}
                                        onDragStart={() => handleDragStart(issue.id)}
                                        onDragEnd={handleDragEnd}
                                        onMouseEnter={() => setHoveredIssueId(issue.id)}
                                        onMouseLeave={() => setHoveredIssueId(null)}
                                        isDragging={draggingIssueId === issue.id}
                                        onIssueClick={onIssueClick}
                                        ref={(el) => {
                                            if (el) cardRefs.current.set(issue.id, el);
                                            else cardRefs.current.delete(issue.id);
                                        }}
                                    />
                                ))}
                                {columnIssues.length === 0 && dragOverStatusId !== status.id && (
                                    <div className="text-center py-10 text-gray-400 text-sm italic">
                                        チケットなし
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* SVG Overlay */}
                <svg className="absolute top-0 left-0 pointer-events-none w-full h-full z-20">
                    {hoveredIssue && (
                        <>
                            {[...(hoveredIssue.relationsFrom || []), ...(hoveredIssue.relationsTo || [])].map((rel, idx) => {
                                const isFromHovered = rel.issueFromId === hoveredIssue.id;
                                const targetId = isFromHovered ? rel.issueToId : rel.issueFromId;
                                const fromEl = cardRefs.current.get(hoveredIssue.id);
                                const toEl = cardRefs.current.get(targetId);

                                if (!fromEl || !toEl) return null;

                                const parentEl = containerRef.current;
                                if (!parentEl) return null;
                                const parentRect = parentEl.getBoundingClientRect();

                                const fromRect = fromEl.getBoundingClientRect();
                                const toRect = toEl.getBoundingClientRect();

                                // Relation is always from -> to.
                                // If hovered is "from", line goes from hovered to target.
                                // If hovered is "to", line goes from target to hovered.
                                const issueFromRect = isFromHovered ? fromRect : toRect;
                                const issueToRect = isFromHovered ? toRect : fromRect;

                                const startX = issueFromRect.left - parentRect.left + issueFromRect.width / 2;
                                const startY = issueFromRect.top - parentRect.top + issueFromRect.height / 2;
                                const endX = issueToRect.left - parentRect.left + issueToRect.width / 2;
                                const endY = issueToRect.top - parentRect.top + issueToRect.height / 2;

                                // Adjust end point to be exactly at the card's edge
                                const dx = endX - startX;
                                const dy = endY - startY;

                                const halfW = issueToRect.width / 2;
                                const halfH = issueToRect.height / 2;

                                // Find intersection t with rectangle boundary: |t*dx| = halfW or |t*dy| = halfH
                                const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
                                const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
                                const t = Math.min(tx, ty);

                                const adjEndX = endX - t * dx;
                                const adjEndY = endY - t * dy;

                                return (
                                    <g key={`${rel.id}-${idx}`}>
                                        <path
                                            d={`M ${startX} ${startY} C ${startX + (endX - startX) / 2} ${startY}, ${startX + (endX - startX) / 2} ${endY}, ${adjEndX} ${adjEndY}`}
                                            stroke="#0ea5e9"
                                            strokeWidth="3"
                                            fill="none"
                                            strokeDasharray="8,5"
                                            opacity="0.8"
                                        />
                                        <circle cx={startX} cy={startY} r="4" fill="#0ea5e9" />
                                    </g>
                                );
                            })}
                        </>
                    )}
                </svg>
            </div>
        </div>
    );
}
