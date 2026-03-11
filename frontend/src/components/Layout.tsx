import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from '../types';
import Breadcrumb from './Breadcrumb';
import {
  Menu, Database, Building2, Settings, LogOut,
  Briefcase, ChevronDown, ChevronRight, Users
} from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

interface TreeItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  key: string;
  adminOnly?: boolean;
  children?: {
    label: string;
    path: string;
    icon: React.ComponentType<any>;
    key: string;
  }[];
}

// ツリー構造のメニュー定義
const TREE_MENU: TreeItem[] = [
  {
    label: 'プロジェクト',
    path: '/projects',
    icon: Briefcase,
    key: 'projects',
  },
  {
    label: '企業',
    path: '/companies',
    icon: Building2,
    key: 'company',
    children: [
      { label: '協会', path: '/associations', icon: Users, key: 'associations' },
      { label: '法人格', path: '/legal-entity-statuses', icon: Database, key: 'legal-entity-statuses' },
    ],
  },
  {
    label: '管理',
    path: '/admin',
    icon: Database,
    key: 'admin',
    adminOnly: true,
  },
];

// ヘッダー用フラットリスト（旧来の設定と互換性を保つ）
const FLAT_MENU = [
  { label: 'プロジェクト', path: '/projects', icon: Briefcase, key: 'projects' },
  { label: '企業', path: '/companies', icon: Building2, key: 'company' },
];

export default function Layout({ user, onLogout, children }: Props) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 各親メニューの展開状態（デフォルトで全展開）
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    new Set(TREE_MENU.filter((item) => item.children).map((item) => item.key))
  );

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // ヘッダーメニュー（ユーザー設定に基づく）
  const headerNavItems = FLAT_MENU.filter((item) => {
    if (item.key === 'projects') return user.showProjectsMenu !== false;
    if (item.key === 'company') return user.showCompanyMenu !== false;
    return true;
  });

  // サイドバーに表示するツリーメニュー（adminOnly はフィルタリング）
  const sideTreeItems = TREE_MENU.filter(
    (item) => !item.adminOnly || user.role === 'admin'
  );

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">

      <div className="flex flex-1 relative overflow-hidden">
        {/* Mobile/Desktop Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={toggleSidebar}
          />
        )}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50
            w-64 bg-white border-r border-gray-200
            transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            flex flex-col h-full
          `}
        >
          <nav className="flex-1 py-4 px-3 overflow-y-auto">
            {sideTreeItems.map((item, idx) => {
              const hasChildren = item.children && item.children.length > 0;
              const expanded = expandedKeys.has(item.key);
              const parentActive = isActive(item.path);

              return (
                <div key={item.key}>
                  {/* セパレーター（最初のアイテム以外） */}
                  {idx > 0 && (
                    <div className="my-2 border-t border-gray-200" />
                  )}

                  {/* 親メニュー行 */}
                  <div className="flex items-center">
                    <Link
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`
                        flex-1 flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors
                        ${parentActive
                          ? 'bg-sky-50 text-sky-700'
                          : 'text-gray-800 hover:bg-gray-100'
                        }
                      `}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </Link>
                    {hasChildren && (
                      <button
                        onClick={() => toggleExpand(item.key)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        aria-label={expanded ? '閉じる' : '開く'}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>

                  {/* 子メニュー */}
                  {hasChildren && expanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {item.children!.map((child, childIdx) => {
                        const isLastChild = childIdx === item.children!.length - 1;
                        return (
                          <div key={child.path} className="flex items-center">
                            {/* ツリーライン */}
                            <div className="flex flex-col items-center mr-1 self-stretch">
                              <div className={`w-px bg-gray-300 ${isLastChild ? 'h-1/2' : 'flex-1'}`} />
                              {!isLastChild && <div className="w-px flex-1 bg-gray-300" />}
                            </div>
                            <div className="flex items-center mr-1">
                              <div className="w-3 h-px bg-gray-300" />
                            </div>
                            <Link
                              to={child.path}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`
                                flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
                                ${isActive(child.path)
                                  ? 'bg-sky-50 text-sky-700 font-medium'
                                  : 'text-gray-600 hover:bg-gray-100'
                                }
                              `}
                            >
                              <child.icon size={15} />
                              {child.label}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <footer className="p-4 border-t border-gray-200 bg-gray-50 space-y-1">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              ログアウト
            </button>
          </footer>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-slate-800 text-white shadow z-30 h-14 flex items-center shrink-0">
            <div className="w-full px-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleSidebar}
                  className="p-2 hover:bg-slate-700 rounded-md transition-colors focus:outline-none"
                  aria-label="Toggle Side Menu"
                >
                  <Menu size={24} />
                </button>
                <Link to="/home" className="text-xl font-bold tracking-tight hover:text-slate-300">
                  ProjectHub
                </Link>
                {/* ヘッダーナビゲーション（ユーザー設定に基づく） */}
                <nav className="hidden md:flex items-center gap-1">
                  {headerNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${isActive(item.path)
                          ? 'bg-slate-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                      `}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/settings"
                  className="text-sm text-slate-300 hidden sm:block hover:text-white transition-colors"
                >
                  {user.lastName} {user.firstName}
                </Link>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto w-full bg-gray-50">
            <div className="max-w-full mx-auto px-4 py-6">
              <Breadcrumb />
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
