import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectOverview from './pages/ProjectOverview';
import ProjectCommentsPage from './pages/ProjectCommentsPage';
import IssueListPage from './pages/IssueListPage';
import IssueDetailPage from './pages/IssueDetailPage';
import IssueFormPage from './pages/IssueFormPage';
import WikiListPage from './pages/WikiListPage'; import GanttPage from './pages/GanttPage';
import GanttAllPage from './pages/GanttAllPage';
import FilesPage from './pages/FilesPage';
import TimeEntriesPage from './pages/TimeEntriesPage';
import AdminPage from './pages/AdminPage';
import CompaniesPage from './pages/CompaniesPage';
import CompanyDetailPage from './pages/CompanyDetailPage';
import SettingsPage from './pages/SettingsPage';
import AssociationsPage from './pages/AssociationsPage';

function App() {
  const { user, loading, login, register, logout, refreshUser } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-lg text-gray-500">読み込み中...</div></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={login} />} />
        <Route path="/register" element={<RegisterPage onRegister={register} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={
          user.landingPage === 'projects' ? <Navigate to="/projects" replace /> :
            user.landingPage === 'gantt' ? <Navigate to="/gantt" replace /> :
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
          <Route path="gantt" element={<GanttPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="time-entries" element={<TimeEntriesPage />} />
        </Route>
        <Route path="/issues/:id" element={<IssueDetailPage user={user} />} />
        <Route path="/issues/:id/edit" element={<IssueFormPage />} />
        <Route path="/gantt" element={<GanttAllPage />} />
        <Route path="/associations" element={<AssociationsPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/:id" element={<CompanyDetailPage />} />
        <Route path="/settings" element={<SettingsPage user={user} refreshUser={refreshUser} />} />
        <Route path="/admin" element={<AdminPage user={user} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default App;
