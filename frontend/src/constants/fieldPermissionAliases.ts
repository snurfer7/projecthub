/** backend/src/constants/fieldPermissionAliases.ts と同期 */
export const FIELD_INPUT_ALIASES: Record<string, string[]> = {
  'projects.issues.fields.startDateTime': [
    'projects.issues.fields.startDate',
    'projects.issues.fields.startDateTime.date',
    'projects.issues.fields.startDateTime.time',
  ],
  'projects.issues.fields.endDateTime': [
    'projects.issues.fields.endDate',
    'projects.issues.fields.endDateTime.date',
    'projects.issues.fields.endDateTime.time',
  ],
  'projects.issues.fields.startDate': ['projects.issues.fields.startDateTime'],
  'projects.issues.fields.endDate': ['projects.issues.fields.endDateTime'],
};

export function codesForFieldInputCheck(code: string): string[] {
  return [code, ...(FIELD_INPUT_ALIASES[code] ?? [])];
}
