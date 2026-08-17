import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import IssueForm from '../components/IssueForm';
import api from '../api/client';
import { PermissionMap } from '../types';

export default function IssueFormPage() {
  const { projectId, id } = useParams<{ projectId?: string; id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const copyFromIssueId = searchParams.get('copyFrom') || undefined;
  const isCopyMode = !isEdit && !!copyFromIssueId;
  const initialDueDateStr = searchParams.get('dueDate');
  const initialStartDateStr = searchParams.get('startDate');
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [resolvedProjectId, setResolvedProjectId] = useState<string | undefined>(projectId);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (projectId) {
          const res = await api.get(`/projects/${projectId}`);
          if (!cancelled) {
            setPermissions(res.data.myPermissions ?? {});
            setResolvedProjectId(projectId);
          }
          return;
        }
        if (id) {
          const issueRes = await api.get(`/issues/${id}`);
          const pid = issueRes.data.projectId;
          const projRes = await api.get(`/projects/${pid}`);
          if (!cancelled) {
            setPermissions(projRes.data.myPermissions ?? {});
            setResolvedProjectId(String(pid));
          }
          return;
        }
        if (copyFromIssueId) {
          const issueRes = await api.get(`/issues/${copyFromIssueId}`);
          const pid = issueRes.data.projectId;
          const projRes = await api.get(`/projects/${pid}`);
          if (!cancelled) {
            setPermissions(projRes.data.myPermissions ?? {});
            setResolvedProjectId(String(pid));
          }
        }
      } catch {
        if (!cancelled) setPermissions({});
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId, id, copyFromIssueId]);

  const pageTitle = isEdit ? 'チケット編集' : isCopyMode ? 'チケットをコピー' : '新規チケット';

  return (
    <div className="max-w-full mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{pageTitle}</h1>
      <IssueForm
        projectId={resolvedProjectId}
        issueId={id}
        copyFromIssueId={copyFromIssueId}
        initialStartDate={isCopyMode ? undefined : (initialStartDateStr || undefined)}
        initialDueDate={isCopyMode ? undefined : (initialDueDateStr || undefined)}
        onSuccess={(savedId) => {
          navigate(`/issues/${savedId}`);
        }}
        onCancel={() => {
          navigate(-1);
        }}
        permissions={permissions}
      />
    </div>
  );
}
