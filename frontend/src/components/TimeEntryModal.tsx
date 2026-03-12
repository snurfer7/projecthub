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
}

export default function TimeEntryModal({ isOpen, onClose, onSuccess, projectId, entry }: TimeEntryModalProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueId, setIssueId] = useState('');
  const [hours, setHours] = useState('');
  const [activity, setActivity] = useState('開発');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/issues', { params: { projectId } }).then((res) => setIssues(res.data)).catch(() => {});
      
      if (entry) {
        setIssueId(entry.issueId ? String(entry.issueId) : '');
        setHours(String(entry.hours));
        setActivity(entry.activity);
        setSpentOn(entry.spentOn.split('T')[0]);
        setComments(entry.comments || '');
      } else {
        setIssueId('');
        setHours('');
        setActivity('開発');
        setSpentOn(new Date().toISOString().split('T')[0]);
        setComments('');
      }
    }
  }, [isOpen, entry, projectId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const data = {
      projectId: Number(projectId),
      issueId: issueId ? Number(issueId) : null,
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
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Combobox
                label="チケット"
                options={issues.map((i) => ({ value: String(i.id), label: `#${i.id} ${i.subject}` }))}
                value={issueId}
                onChange={setIssueId}
                size="medium"
              />
            </div>
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
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting}
            className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-300">キャンセル</button>
          <button type="submit" disabled={submitting}
            className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm hover:bg-sky-700">
            {submitting ? '保存中...' : entry ? '更新' : '追加'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
