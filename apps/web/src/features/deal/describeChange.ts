import { formatMoney } from '../../lib/format';
import type { FieldDefinition, HistoryEntry, User } from '../../graphql/types';

const ATTRIBUTE_LABELS: Record<string, string> = {
  name: 'Name',
  company: 'Company',
  amountCents: 'Amount',
  currency: 'Currency',
  ownerId: 'Owner',
};

interface Lookups {
  fields: FieldDefinition[];
  users: User[];
  currency: string;
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  return String(value);
}

function stageName(value: unknown): string {
  return typeof value === 'object' && value !== null && 'name' in value ? String((value as { name: unknown }).name) : '?';
}

/** One readable sentence per history entry, e.g. "moved from Lead to Diligence". */
export function describeChange(entry: HistoryEntry, { fields, users, currency }: Lookups): string {
  switch (entry.kind) {
    case 'created': {
      const stage = stageName((entry.newValue as { stage?: unknown } | null)?.stage);
      return `created the deal in ${stage}`;
    }
    case 'stage_changed':
      return `moved it from ${stageName(entry.oldValue)} to ${stageName(entry.newValue)}`;
    case 'attribute_changed': {
      const label = ATTRIBUTE_LABELS[entry.field ?? ''] ?? entry.field ?? 'a value';
      if (entry.field === 'amountCents') {
        const fmt = (v: unknown) => (typeof v === 'number' ? formatMoney(v, currency, false) : show(v));
        return `changed ${label} from ${fmt(entry.oldValue)} to ${fmt(entry.newValue)}`;
      }
      if (entry.field === 'ownerId') {
        const name = (v: unknown) => users.find((u) => u.id === v)?.name ?? (v ? 'a former member' : 'nobody');
        return `reassigned it from ${name(entry.oldValue)} to ${name(entry.newValue)}`;
      }
      return `changed ${label} from ${show(entry.oldValue)} to ${show(entry.newValue)}`;
    }
    case 'field_changed': {
      const field = fields.find((f) => f.key === entry.field);
      const label = field?.label ?? entry.field ?? 'a field';
      const unit = field?.type === 'metric' && field.unit ? field.unit : '';
      const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? 'empty' : `${String(v)}${unit}`);
      if (entry.oldValue === null || entry.oldValue === undefined) return `set ${label} to ${fmt(entry.newValue)}`;
      return `changed ${label} from ${fmt(entry.oldValue)} to ${fmt(entry.newValue)}`;
    }
  }
}
