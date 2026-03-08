import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import IssueForm from '../components/IssueForm';

export default function IssueFormPage() {
  const { projectId, id } = useParams<{ projectId?: string; id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const initialDueDateStr = searchParams.get('dueDate');

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{isEdit ? 'チケット編集' : '新規チケット'}</h1>
      <IssueForm
        projectId={projectId}
        issueId={id}
        initialDueDate={initialDueDateStr || undefined}
        onSuccess={(savedId) => {
          navigate(`/issues/${savedId}`);
        }}
        onCancel={() => {
          navigate(-1);
        }}
      />
    </div>
  );
}
