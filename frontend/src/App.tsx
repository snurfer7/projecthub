import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';

// 認証前ページ（初回表示で必要）
const LoginPage = lazy(() => import('./pages/LoginPage'));


// 認証後ページ（ルート単位で遅延読み込み）
const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectListPage = lazy(() => import('./pages/ProjectListPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const ProjectOverview = lazy(() => import('./pages/ProjectOverview'));
const ProjectCommentsPage = lazy(() => import('./pages/ProjectCommentsPage'));
const IssueListPage = lazy(() => import('./pages/IssueListPage'));
const IssueDetailPage = lazy(() => import('./pages/IssueDetailPage'));
const IssueFormPage = lazy(() => import('./pages/IssueFormPage'));
const WikiListPage = lazy(() => import('./pages/WikiListPage'));
const GanttPage = lazy(() => import('./pages/GanttPage'));
const KanbanPage = lazy(() => import('./pages/KanbanPage'));
const TimeEntriesPage = lazy(() => import('./pages/TimeEntriesPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AssociationsPage = lazy(() => import('./pages/AssociationsPage'));
const LegalEntityStatusesPage = lazy(() => import('./pages/LegalEntityStatusesPage'));
const ForcePasswordChangePage = lazy(() => import('./pages/ForcePasswordChangePage'));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="text-gray-500">読み込み中...</div>
  </div>
);

function App() {
  const { user, loading, login, logout, refreshUser } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-lg text-gray-500">読み込み中...</div></div>;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={login} />} />

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Suspense>
    );
  }

  if (user.status === 'pending') {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/force-password-change" element={<ForcePasswordChangePage refreshUser={refreshUser} />} />
          <Route path="*" element={<Navigate to="/force-password-change" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Layout user={user} onLogout={logout}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={
            user.landingPage === 'projects' ? <Navigate to="/projects" replace /> :
              user.landingPage === 'gantt' ? <Navigate to="/projects?view=gantt" replace /> :
                user.landingPage === 'companies' ? <Navigate to="/companies" replace /> :
                  <Navigate to="/home" replace />
          } />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />}>
            <Route index element={<ProjectOverview />} />
            <Route path="issues" element={<IssueListPage />} />
            <Route path="issues/new" element={<IssueFormPage />} />
            <Route path="wiki" element={<WikiListPage />} />
            <Route path="comments" element={<ProjectCommentsPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="gantt" element={<GanttPage />} />
            <Route path="time-entries" element={<TimeEntriesPage />} />
          </Route>
          <Route path="/issues/:id" element={<IssueDetailPage user={user} />} />
          <Route path="/issues/:id/edit" element={<IssueFormPage />} />
          <Route path="/associations" element={<AssociationsPage />} />
          <Route path="/legal-entity-statuses" element={<LegalEntityStatusesPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/:id" element={<CompanyDetailPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/settings" element={<SettingsPage user={user} refreshUser={refreshUser} />} />
          <Route path="/admin" element={<AdminPage user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;
