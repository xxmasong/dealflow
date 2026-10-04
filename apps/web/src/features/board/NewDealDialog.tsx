import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import type { Stage, User } from '../../graphql/types';
import { useCreateDeal } from './useBoard';

interface Props {
  open: boolean;
  stages: Stage[];
  users: User[];
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function NewDealDialog({ open, stages, users, onClose, onCreated }: Props) {
  const create = useCreateDeal();
  const [form, setForm] = useState({ company: '', name: '', amount: '', stageId: '', ownerId: '' });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount || 0);
    const { createDeal } = await create.mutateAsync({
      company: form.company,
      name: form.name,
      amountCents: Math.round(amount * 100),
      currency: 'USD',
      stageId: form.stageId || stages[0]!.id,
      ownerId: form.ownerId || null,
    });
    setForm({ company: '', name: '', amount: '', stageId: '', ownerId: '' });
    create.reset();
    onCreated(createDeal.id);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle>New deal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {create.error && <Alert severity="error">{create.error.message}</Alert>}
            <TextField label="Company" value={form.company} onChange={set('company')} required autoFocus />
            <TextField label="Deal name" value={form.name} onChange={set('name')} required placeholder="Seed round" />
            <TextField
              label="Amount (USD)"
              type="number"
              value={form.amount}
              onChange={set('amount')}
              slotProps={{ htmlInput: { min: 0, step: 1000 } }}
            />
            <TextField select label="Stage" value={form.stageId || stages[0]?.id || ''} onChange={set('stageId')}>
              {stages.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Owner" value={form.ownerId} onChange={set('ownerId')}>
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={create.isPending}>
            Create deal
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
