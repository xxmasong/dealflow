import { InputAdornment, MenuItem, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import type { FieldDefinition, FieldValue } from '../../graphql/types';

interface Props {
  field: FieldDefinition;
  value: FieldValue;
  onSave: (value: FieldValue) => void;
  disabled?: boolean;
}

const toText = (v: FieldValue) => (v === null || v === undefined ? '' : String(v));

/** One editor per field type. Text-like inputs save on blur; selects save on change. */
export function FieldInput({ field, value, onSave, disabled }: Props) {
  const [draft, setDraft] = useState(toText(value));
  useEffect(() => setDraft(toText(value)), [value]);

  const commit = (next: string) => {
    if (next === toText(value)) return;
    if (next === '') return onSave(null);
    onSave(field.type === 'number' || field.type === 'metric' ? Number(next) : next);
  };

  if (field.type === 'select') {
    return (
      <TextField
        select
        size="small"
        fullWidth
        label={field.label}
        value={draft}
        disabled={disabled || field.archived}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
      >
        <MenuItem value="">
          <em>Not set</em>
        </MenuItem>
        {field.options.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const numeric = field.type === 'number' || field.type === 'metric';
  return (
    <TextField
      size="small"
      fullWidth
      label={field.label}
      type={numeric ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={draft}
      disabled={disabled || field.archived}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      slotProps={{
        inputLabel: field.type === 'date' ? { shrink: true } : undefined,
        input:
          field.type === 'metric' && field.unit
            ? { endAdornment: <InputAdornment position="end">{field.unit}</InputAdornment> }
            : undefined,
      }}
    />
  );
}
