import { PermissionMap } from '../types';

const ROUTE_CANDIDATES: Array<{ path: string; code: string }> = [
  { path: '/home', code: 'home' },
  { path: '/projects', code: 'projects' },
  { path: '/companies', code: 'companies' },
  { path: '/contacts', code: 'contacts' },
  { path: '/settings', code: 'settings' },
  { path: '/admin', code: 'admin' },
];

export function resolveDefaultRoute(
  landingPage: string | undefined,
  permissions?: PermissionMap
): string {
  const canUse = (code: string) => permissions?.[code]?.canUse === true;

  const landingCandidates: Record<string, string> = {
    home: '/home',
    projects: '/projects',
    gantt: '/projects?view=gantt',
    companies: '/companies',
  };
  const preferred = landingPage ? landingCandidates[landingPage] : '/home';
  if (preferred) {
    const code = preferred.startsWith('/projects')
      ? 'projects'
      : preferred.startsWith('/companies')
        ? 'companies'
        : 'home';
    if (!permissions || canUse(code)) return preferred;
  }

  for (const { path, code } of ROUTE_CANDIDATES) {
    if (canUse(code)) return path;
  }

  return '/no-access';
}
