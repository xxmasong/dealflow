import AddIcon from '@mui/icons-material/Add';
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveIcon from '@mui/icons-material/UnarchiveOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNotify } from '../../components/Notifier';
import { ARCHIVE_FIELD, CREATE_FIELD, FIELD_DEFINITIONS } from '../../graphql/documents';
import type { FieldDefinition, FieldType } from '../../graphql/types';
import { request } from '../../lib/api';

const TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'metric', label: 'Metric (with unit)' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Single select' },
];

export function FieldsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const fields = useQuery({
    queryKey: ['fields'],
    queryFn: () => request<{ fieldDefinitions: FieldDefinition[] }>(FIELD_DEFINITIONS),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['fields'] });
    void queryClient.invalidateQueries({ queryKey: ['board'] });
    void queryClient.invalidateQueries({ queryKey: ['deal'] });
  };

  const [form, setForm] = useState({ label: '', type: 'text' as FieldType, options: '', unit: '' });
  const create = useMutation({
    mutationFn: () =>
      request(CREATE_FIELD, {
        input: {
          label: form.label,
          type: form.type,
          options:
            form.type === 'select'
              ? form.options
                  .split(',')
                  .map((o) => o.trim())
                  .filter(Boolean)
              : [],
          unit: form.type === 'metric' ? form.unit || null : null,
        },
      }),
    onSuccess: () => {
      setForm({ label: '', type: 'text', options: '', unit: '' });
      notify('Field added', 'success');
      refresh();
    },
  });
  const archive = useMutation({
    mutationFn: (f: FieldDefinition) => request(ARCHIVE_FIELD, { id: f.id, archived: !f.archived }),
    onSuccess: refresh,
    onError: (err: Error) => notify(err.message, 'error'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 960 }}>
      <Box>
        <Typography variant="h5">Custom fields</Typography>
        <Typography variant="body2" color="text.secondary">
          Fields appear on every deal. Archiving hides a field but keeps its values and history.
        </Typography>
      </Box>

      <Card sx={{ p: 2.5 }}>
        <Stack
          component="form"
          onSubmit={submit}
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'flex-start' }}
        >
          <TextField
            size="small"
            label="Label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            required
          />
          <TextField
            select
            size="small"
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as FieldType })}
            sx={{ minWidth: 180 }}
          >
            {TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          {form.type === 'select' && (
            <TextField
              size="small"
              label="Options"
              helperText="Comma separated"
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              sx={{ flex: 1 }}
            />
          )}
          {form.type === 'metric' && (
            <TextField
              size="small"
              label="Unit"
              placeholder="%"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              sx={{ width: 100 }}
            />
          )}
          <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={create.isPending}>
            Add field
          </Button>
        </Stack>
        {create.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {create.error.message}
          </Alert>
        )}
      </Card>

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Key</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Options / unit</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.data?.fieldDefinitions.map((f) => (
              <TableRow key={f.id} sx={{ opacity: f.archived ? 0.5 : 1 }}>
                <TableCell>
                  {f.label} {f.archived && <Chip size="small" label="Archived" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>
                  <code>{f.key}</code>
                </TableCell>
                <TableCell>{TYPES.find((t) => t.value === f.type)?.label}</TableCell>
                <TableCell>{f.type === 'select' ? f.options.join(', ') : (f.unit ?? '')}</TableCell>
                <TableCell align="right">
                  <Tooltip title={f.archived ? 'Restore' : 'Archive'}>
                    <IconButton
                      size="small"
                      onClick={() => archive.mutate(f)}
                      aria-label={f.archived ? `Restore ${f.label}` : `Archive ${f.label}`}
                    >
                      {f.archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
