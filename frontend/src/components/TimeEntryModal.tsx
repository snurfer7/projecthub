import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { TimeEntry, Issue } from '../types';
import Combobox from './Combobox';
import NumberInput from './NumberInput';
import TextInput from './TextInput';
import DateInput from './DateInput';
import Modal from './Modal';

interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  entry?: TimeEntry;
  /** 指定時はチケットを固定し、チケット選択 UI を出さない（チケット詳細からの追加・編集） */
  fixedIssueId?: number;
}

export default function TimeEntryModal({ isOpen, onClose, onSuccess, projectId, entry, fixedIssueId }: TimeEntryModalProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueId, setIssueId] = useState('');
  const [hours, setHours] = useState('');
  const [activity, setActivity] = useState('開発');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const issueLocked = fixedIssueId != null;

  useEffect(() => {
    if (isOpen) {
      if (!issueLocked) {
        api.get('/issues', { params: { projectId } }).then((res) => setIssues(res.data)).catch(() => {});
      }

      if (entry) {
        setIssueId(entry.issueId ? String(entry.issueId) : (fixedIssueId != null ? String(fixedIssueId) : ''));
        setHours(String(entry.hours));
        setActivity(entry.activity);
        setSpentOn(entry.spentOn.split('T')[0]);
        setComments(entry.comments || '');
      } else {
        setIssueId(fixedIssueId != null ? String(fixedIssueId) : '');
        setHours('');
        setActivity('開発');
        setSpentOn(new Date().toISOString().split('T')[0]);
        setComments('');
      }
    }
  }, [isOpen, entry, projectId, fixedIssueId, issueLocked]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const resolvedIssueId = fixedIssueId != null
      ? fixedIssueId
      : (issueId ? Number(issueId) : null);
    const data = {
      projectId: Number(projectId),
      issueId: resolvedIssueId,
      hours: Number(hours),
      activity,
      spentOn,
      comments,
    };

    try {
      if (entry) {
        await api.put(`/time-entries/${entry.id}`, data);
      } else {
        await api.post('/time-entries', data);
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      alert('保存に失敗しました: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? "時間記録の編集" : "時間記録の追加"}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting}
            className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-300">キャンセル</button>
          <button type="submit" form="time-entry-form" disabled={submitting}
            className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm hover:bg-sky-700">
            {submitting ? '保存中...' : entry ? '更新' : '追加'}
          </button>
        </>
      }
    >
      <form id="time-entry-form" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className={`grid grid-cols-1 ${issueLocked ? '' : 'md:grid-cols-2'} gap-4`}>
            {!issueLocked && (
              <div>
                <Combobox
                  label="チケット"
                  options={issues.map((i) => ({ value: String(i.id), label: `#${i.id} ${i.subject}` }))}
                  value={issueId}
                  onChange={setIssueId}
                  size="medium"
                />
              </div>
            )}
            <div>
              <NumberInput
                label="時間 *"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                step="0.25"
                min="0.25"
                endAdornment="時間"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Combobox
                label="活動"
                options={[
                  { value: '開発', label: '開発' },
                  { value: '設計', label: '設計' },
                  { value: 'レビュー', label: 'レビュー' },
                  { value: 'テスト', label: 'テスト' },
                  { value: 'ドキュメント', label: 'ドキュメント' },
                  { value: 'その他', label: 'その他' },
                ]}
                value={activity}
                onChange={setActivity}
                size="medium"
              />
            </div>
            <div>
              <DateInput
                label="日付"
                value={spentOn}
                onChange={setSpentOn}
                required
              />
            </div>
          </div>
          <div>
            <TextInput
              label="コメント"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              size="medium"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
