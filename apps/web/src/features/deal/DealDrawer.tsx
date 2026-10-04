import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Divider,
  Drawer,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNotify } from '../../components/Notifier';
import { DEAL, MOVE_DEAL, SET_FIELD_VALUE, UPDATE_DEAL } from '../../graphql/documents';
import type { DealDetail, FieldDefinition, FieldValue, Stage, User } from '../../graphql/types';
import { request } from '../../lib/api';
import { FieldInput } from './FieldInput';
import { HistoryTimeline } from './HistoryTimeline';

interface DealQuery {
  deal: DealDetail;
  stages: Stage[];
  users: User[];
  fieldDefinitions: FieldDefinition[];
}

interface Props {
  dealId: string | null;
  onClose: () => void;
}

export function DealDrawer({ dealId, onClose }: Props) {
  return (
    <Drawer
      anchor="right"
      open={dealId !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 } } } }}
    >
      {dealId && <DealDetails dealId={dealId} onClose={onClose} />}
    </Drawer>
  );
}

function useDealMutations(dealId: string) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
    void queryClient.invalidateQueries({ queryKey: ['board'] });
    void queryClient.invalidateQueries({ queryKey: ['report'] });
  };
  const onError = (err: Error) => notify(err.message, 'error');
  return {
    update: useMutation({
      mutationFn: (input: Record<string, unknown>) => request(UPDATE_DEAL, { id: dealId, input }),
      onSuccess: refresh,
      onError,
    }),
    move: useMutation({
      mutationFn: (stageId: string) => request(MOVE_DEAL, { id: dealId, stageId }),
      onSuccess: refresh,
      onError,
    }),
    setField: useMutation({
      mutationFn: ({ fieldId, value }: { fieldId: string; value: FieldValue }) =>
        request(SET_FIELD_VALUE, { dealId, fieldId, value }),
      onSuccess: refresh,
      onError,
    }),
  };
}

/** Text field that keeps a local draft and saves on blur or Enter. */
function InlineText({
  label,
  value,
  onSave,
  ...rest
}: { label: string; value: string; onSave: (v: string) => void } & Omit<
  React.ComponentProps<typeof TextField>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      {...rest}
    />
  );
}

function DealDetails({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ['deal', dealId], queryFn: () => request<DealQuery>(DEAL, { id: dealId }) });
  const { update, move, setField } = useDealMutations(dealId);

  if (query.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{query.error.message}</Alert>
      </Box>
    );
  }
  if (!query.data) {
    return (
      <Stack spacing={2} sx={{ p: 3 }}>
        <Skeleton width="60%" height={36} />
        <Skeleton variant="rounded" height={160} />
        <Skeleton variant="rounded" height={220} />
      </Stack>
    );
  }

  const { deal, stages, users, fieldDefinitions } = query.data;
  const values = new Map(deal.fields.map((f) => [f.field.id, f.value]));
  const visibleFields = fieldDefinitions.filter((f) => !f.archived || values.has(f.id));

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" sx={{ p: 3, pb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {deal.stage.name}
          </Typography>
          <Typography variant="h5" noWrap>
            {deal.company}
          </Typography>
          <Typography color="text.secondary" noWrap>
            {deal.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />
      <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Details
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={12}>
            <InlineText label="Company" value={deal.company} onSave={(company) => update.mutate({ company })} />
          </Grid>
          <Grid size={12}>
            <InlineText label="Deal name" value={deal.name} onSave={(name) => update.mutate({ name })} />
          </Grid>
          <Grid size={6}>
            <InlineText
              label="Amount"
              type="number"
              value={String(deal.amountCents / 100)}
              onSave={(v) => update.mutate({ amountCents: Math.round(Number(v || 0) * 100) })}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">{deal.currency}</InputAdornment> },
              }}
            />
          </Grid>
          <Grid size={6}>
            <TextField
              select
              size="small"
              fullWidth
              label="Stage"
              value={deal.stage.id}
              onChange={(e) => move.mutate(e.target.value)}
            >
              {stages.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField
              select
              size="small"
              fullWidth
              label="Owner"
              value={deal.owner?.id ?? ''}
              onChange={(e) => update.mutate({ ownerId: e.target.value || null })}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          Custom fields
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {visibleFields.map((field) => (
            <Grid key={field.id} size={field.type === 'text' ? 12 : 6}>
              <FieldInput
                field={field}
                value={values.get(field.id) ?? null}
                onSave={(value) => setField.mutate({ fieldId: field.id, value })}
              />
            </Grid>
          ))}
          {visibleFields.length === 0 && (
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary">
                No custom fields yet. Add them on the Fields page.
              </Typography>
            </Grid>
          )}
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          History
        </Typography>
        <HistoryTimeline entries={deal.history} fields={fieldDefinitions} users={users} currency={deal.currency} />
      </Box>
    </Stack>
  );
}
