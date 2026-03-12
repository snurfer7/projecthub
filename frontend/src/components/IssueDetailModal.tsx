import { User } from '../types';
import Modal from './Modal';
import IssueDetail from './IssueDetail';

interface IssueDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    issueId: string | number | null;
    user: User;
    onEdit?: (issueId: string) => void;
    onRefresh?: () => void;
}

export default function IssueDetailModal({
    isOpen,
    onClose,
    issueId,
    user,
    onEdit,
    onRefresh
}: IssueDetailModalProps) {
    if (!isOpen || !issueId) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="チケット詳細"
            size="xl"
        >
            <IssueDetail
                issueId={String(issueId)}
                user={user}
                onEdit={onEdit ? () => onEdit(String(issueId)) : undefined}
                onRefresh={onRefresh}
            />
        </Modal>
    );
}
