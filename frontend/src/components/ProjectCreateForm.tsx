import { FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { Company, Project } from '../types';
import { formatContactDisplayName, generateIdentifier } from '../utils/format';
import { getProjectSelectLabelParts } from '../utils/projectTree';
import Combobox from './Combobox';
import TextInput from './TextInput';
import DateInput from './DateInput';

export type ProjectCreateFormValues = {
  name: string;
  identifier: string;
  description: string;
  companyId: string;
  locationId: string;
  contactId: string;
  parentId: string;
  dueDate: string;
};

export const emptyProjectCreateFormValues = (): ProjectCreateFormValues => ({
  name: '',
  identifier: generateIdentifier(),
  description: '',
  companyId: '',
  locationId: '',
  contactId: '',
  parentId: '',
  dueDate: '',
});

type ProjectCreateFormProps = {
  formId: string;
  values: ProjectCreateFormValues;
  onChange: (patch: Partial<ProjectCreateFormValues>) => void;
  onSubmit: (e: FormEvent) => void;
  companies: Company[];
  projects: Project[];
  excludeProjectId?: number | null;
  /** 活動に紐づく商談名など、参照表示のみ（送信しない） */
  dealName?: string | null;
};

export default function ProjectCreateForm({
  formId,
  values,
  onChange,
  onSubmit,
  companies,
  projects,
  excludeProjectId,
  dealName,
}: ProjectCreateFormProps) {
  const selectedCompany = companies.find((c) => String(c.id) === values.companyId);
  const availableLocations = selectedCompany?.locations || [];
  const availableContacts = selectedCompany?.contacts || [];

  const handleCompanyChange = (id: string) => {
    onChange({ companyId: id, locationId: '', contactId: '' });
  };

  const handleParentChange = (val: string) => {
    const patch: Partial<ProjectCreateFormValues> = { parentId: val };
    if (val) {
      const parent = projects.find((p) => String(p.id) === val);
      if (parent?.dueDate) {
        patch.dueDate = parent.dueDate.slice(0, 10);
      }
    }
    onChange(patch);
  };

  return (
    <form id={formId} onSubmit={onSubmit}>
      {dealName && (
        <div className="mb-4 text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded px-3 py-2">
          関連商談（参照）: <span className="font-medium text-indigo-700">{dealName}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <TextInput
          label="プロジェクト名 *"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
        <TextInput
          label="識別子 *"
          value={values.identifier}
          onChange={(e) => onChange({ identifier: e.target.value })}
          required
          pattern="[a-z0-9-]+"
          title="小文字英数字とハイフンのみ"
          endAdornment={
            <button
              type="button"
              onClick={() => onChange({ identifier: generateIdentifier() })}
              className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
              title="識別子を再生成"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Combobox
          label="企業"
          options={[
            { value: '', label: 'なし' },
            ...companies.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          value={values.companyId}
          onChange={handleCompanyChange}
          size="medium"
        />
        <Combobox
          label="親プロジェクト"
          options={[
            { value: '', label: 'なし' },
            ...projects
              .filter((p) => p.id !== excludeProjectId)
              .map((p) => {
                const { primary, secondary } = getProjectSelectLabelParts(p, projects);
                return {
                  value: String(p.id),
                  label: primary,
                  secondaryLabel: secondary || undefined,
                };
              }),
          ]}
          value={values.parentId}
          onChange={handleParentChange}
          size="medium"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Combobox
          label="拠点"
          options={[
            { value: '', label: 'なし' },
            ...availableLocations.map((l) => ({ value: String(l.id), label: l.name })),
          ]}
          value={values.locationId}
          onChange={(val) => onChange({ locationId: val })}
          disabled={!values.companyId}
          size="medium"
        />
        <Combobox
          label="先方担当者"
          options={[
            { value: '', label: 'なし' },
            ...availableContacts.map((c) => ({
              value: String(c.id),
              label: formatContactDisplayName(c.lastName, c.firstName),
            })),
          ]}
          value={values.contactId}
          onChange={(val) => onChange({ contactId: val })}
          disabled={!values.companyId}
          size="medium"
        />
      </div>
      <div className="mb-4">
        <DateInput
          label="期限日"
          id={`${formId}-due-date`}
          value={values.dueDate}
          onChange={(val) => onChange({ dueDate: val })}
        />
      </div>
      <div className="mb-4">
        <TextInput
          label="説明"
          isMultiline
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>
    </form>
  );
}

export function projectCreatePayload(
  values: ProjectCreateFormValues,
  extra?: { sourceActivityId?: number },
) {
  return {
    name: values.name,
    identifier: values.identifier,
    description: values.description || null,
    companyId: values.companyId ? Number(values.companyId) : null,
    locationId: values.locationId ? Number(values.locationId) : null,
    contactId: values.contactId ? Number(values.contactId) : null,
    parentId: values.parentId ? Number(values.parentId) : null,
    dueDate: values.dueDate || null,
    ...(extra?.sourceActivityId != null ? { sourceActivityId: extra.sourceActivityId } : {}),
  };
}
