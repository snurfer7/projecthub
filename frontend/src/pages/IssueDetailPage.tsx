import { useParams } from 'react-router-dom';
import { User } from '../types';
import IssueDetail from '../components/IssueDetail';

interface Props {
  user: User;
}

export default function IssueDetailPage({ user }: Props) {
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <IssueDetail issueId={id} user={user} />
    </div>
  );
}
