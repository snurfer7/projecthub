import { useEffect, useState } from 'react';
import { Link, useLocation, matchPath } from 'react-router-dom';
import api from '../api/client';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface ProjectCache {
  [key: string]: string;
}

interface IssueCache {
  [key: string]: { subject: string; projectId: number; projectName: string };
}

interface WikiCache {
  [key: string]: { title: string; projectId: number; projectName: string };
}

interface CompanyCache {
  [key: string]: string;
}

export default function Breadcrumb() {
  const location = useLocation();
  const [projectNames, setProjectNames] = useState<ProjectCache>({});
  const [issueCache, setIssueCache] = useState<IssueCache>({});
  const [wikiCache, setWikiCache] = useState<WikiCache>({});
  const [companyCache, setCompanyCache] = useState<CompanyCache>({});

  // Extract IDs from URL patterns
  const projectMatch = matchPath('/projects/:id', location.pathname);
  const projectEditMatch = matchPath('/projects/:id/edit', location.pathname);
  const projectSubMatch = matchPath('/projects/:projectId/:section/*', location.pathname);
  const issueMatch = matchPath('/issues/:id', location.pathname);
  const issueEditMatch = matchPath('/issues/:id/edit', location.pathname);
  const wikiMatch = matchPath('/wiki/:id', location.pathname);
  const wikiEditMatch = matchPath('/wiki/:id/edit', location.pathname);
  const companyMatch = matchPath('/companies/:id', location.pathname);

  // Determine which project ID to fetch
  const projectId = projectMatch?.params.id || projectEditMatch?.params.id || projectSubMatch?.params.projectId;
  const issueId = issueMatch?.params.id || issueEditMatch?.params.id;
  const wikiId = wikiMatch?.params.id || wikiEditMatch?.params.id;
  const companyId = companyMatch?.params.id;

  useEffect(() => {
    if (projectId && !projectNames[projectId]) {
      api.get(`/projects/${projectId}`).then((res) => {
        setProjectNames((prev) => ({ ...prev, [projectId]: res.data.name }));
      }).catch(() => { });
    }
  }, [projectId]);

  useEffect(() => {
    if (issueId && !issueCache[issueId]) {
      api.get(`/issues/${issueId}`).then((res) => {
        setIssueCache((prev) => ({
          ...prev,
          [issueId]: {
            subject: res.data.subject,
            projectId: res.data.projectId,
            projectName: res.data.project?.name || '',
          },
        }));
        // Also cache the project name
        const pid = String(res.data.projectId);
        if (res.data.project?.name) {
          setProjectNames((prev) => ({ ...prev, [pid]: res.data.project.name }));
        }
      }).catch(() => { });
    }
  }, [issueId]);

  useEffect(() => {
    if (wikiId && !wikiCache[wikiId]) {
      api.get(`/wiki/${wikiId}`).then((res) => {
        setWikiCache((prev) => ({
          ...prev,
          [wikiId]: {
            title: res.data.title,
            projectId: res.data.projectId,
            projectName: res.data.project?.name || '',
          },
        }));
        const pid = String(res.data.projectId);
        if (res.data.project?.name) {
          setProjectNames((prev) => ({ ...prev, [pid]: res.data.project.name }));
        }
      }).catch(() => { });
    }
  }, [wikiId]);

  useEffect(() => {
    if (companyId && !companyCache[companyId]) {
      api.get(`/admin/companies/${companyId}`).then((res) => {
        setCompanyCache((prev) => ({ ...prev, [companyId]: res.data.name }));
      }).catch(() => { });
    }
  }, [companyId]);

  const items: BreadcrumbItem[] = [{ label: 'ホーム', path: '/home' }];
  const pathname = location.pathname;

  if (pathname === '/' || pathname === '/home') {
    // Dashboard - only show Home
    return null;
  } else if (pathname === '/gantt') {
    items.push({ label: 'ガントチャート' });
  } else if (pathname === '/companies') {
    items.push({ label: '企業' });
  } else if (companyMatch) {
    const cid = companyMatch.params.id!;
    items.push({ label: '企業', path: '/companies' });
    items.push({ label: companyCache[cid] || '...' });
  } else if (pathname === '/admin') {
    items.push({ label: '管理' });
  } else if (pathname === '/projects') {
    items.push({ label: 'プロジェクト' });
  } else if (projectEditMatch) {
    const pid = projectEditMatch.params.id!;
    items.push({ label: 'プロジェクト', path: '/projects' });
    items.push({ label: projectNames[pid] || '...', path: `/projects/${pid}` });
    items.push({ label: '設定' });
  } else if (projectSubMatch) {
    const pid = projectSubMatch.params.projectId!;
    const section = projectSubMatch.params.section;
    const rest = projectSubMatch.params['*'];
    items.push({ label: 'プロジェクト', path: '/projects' });
    items.push({ label: projectNames[pid] || '...', path: `/projects/${pid}` });
  } else if (projectMatch) {
    const pid = projectMatch.params.id!;
    items.push({ label: 'プロジェクト', path: '/projects' });
    items.push({ label: projectNames[pid] || '...' });
  } else if (issueEditMatch) {
    const iid = issueEditMatch.params.id!;
    const issue = issueCache[iid];
    if (issue) {
      const pid = String(issue.projectId);
      items.push({ label: 'プロジェクト', path: '/projects' });
      items.push({ label: issue.projectName || '...', path: `/projects/${pid}` });
      items.push({ label: 'チケット', path: `/projects/${pid}/issues` });
      items.push({ label: `#${iid}`, path: `/issues/${iid}` });
      items.push({ label: '編集' });
    } else {
      items.push({ label: '...' });
    }
  } else if (issueMatch) {
    const iid = issueMatch.params.id!;
    const issue = issueCache[iid];
    if (issue) {
      const pid = String(issue.projectId);
      items.push({ label: 'プロジェクト', path: '/projects' });
      items.push({ label: issue.projectName || '...', path: `/projects/${pid}` });
      items.push({ label: 'チケット', path: `/projects/${pid}/issues` });
      items.push({ label: `#${iid} ${issue.subject}` });
    } else {
      items.push({ label: '...' });
    }
  } else if (wikiEditMatch) {
    const wid = wikiEditMatch.params.id!;
    const wiki = wikiCache[wid];
    if (wiki) {
      const pid = String(wiki.projectId);
      items.push({ label: 'プロジェクト', path: '/projects' });
      items.push({ label: wiki.projectName || '...', path: `/projects/${pid}` });
      items.push({ label: 'Wiki', path: `/projects/${pid}/wiki` });
      items.push({ label: wiki.title, path: `/wiki/${wid}` });
      items.push({ label: '編集' });
    } else {
      items.push({ label: '...' });
    }
  } else if (wikiMatch) {
    const wid = wikiMatch.params.id!;
    const wiki = wikiCache[wid];
    if (wiki) {
      const pid = String(wiki.projectId);
      items.push({ label: 'プロジェクト', path: '/projects' });
      items.push({ label: wiki.projectName || '...', path: `/projects/${pid}` });
      items.push({ label: 'Wiki', path: `/projects/${pid}/wiki` });
      items.push({ label: wiki.title });
    } else {
      items.push({ label: '...' });
    }
  }

  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-300">/</span>}
          {item.path && i < items.length - 1 ? (
            <Link to={item.path} className="text-sky-600 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'text-gray-700 font-medium' : ''}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
