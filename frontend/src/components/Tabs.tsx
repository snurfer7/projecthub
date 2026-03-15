import { Link } from 'react-router-dom';

interface TabItem {
  key?: string;
  label: string;
  path?: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab?: string;
  currentPath?: string;
  onTabChange?: (key: string) => void;
  className?: string;
}

export default function Tabs({
  tabs,
  activeTab,
  currentPath,
  onTabChange,
  className = '',
}: TabsProps) {
  return (
    <div className={`border-b mb-4 ${className}`}>
      <div className="flex gap-0">
        {tabs.map((tab) => {
          const isButton = !!onTabChange && !!tab.key;
          const isActive = isButton
            ? activeTab === tab.key
            : currentPath
              ? tab.label === '概要'
                ? currentPath === tab.path || currentPath === `${tab.path}/`
                : tab.path ? currentPath.startsWith(tab.path) : false
              : false;

          const baseClass = `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            isActive
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`;

          if (isButton) {
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key!)}
                className={baseClass}
              >
                {tab.label}{' '}
                {tab.count !== undefined && (
                  <span className="text-xs text-gray-400 ml-1">({tab.count})</span>
                )}
              </button>
            );
          }

          return (
            <Link key={tab.path} to={tab.path || '#'} className={baseClass}>
              {tab.label}{' '}
              {tab.count !== undefined && (
                <span className="text-xs text-gray-400 ml-1">({tab.count})</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
