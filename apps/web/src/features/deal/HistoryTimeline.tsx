import { Avatar, Box, Stack, Tooltip, Typography } from '@mui/material';
import type { FieldDefinition, HistoryEntry, User } from '../../graphql/types';
import { timeAgo } from '../../lib/format';
import { describeChange } from './describeChange';

interface Props {
  entries: HistoryEntry[];
  fields: FieldDefinition[];
  users: User[];
  currency: string;
}

export function HistoryTimeline({ entries, fields, users, currency }: Props) {
  if (entries.length === 0) {
    return <Typography color="text.secondary">No changes yet.</Typography>;
  }
  return (
    <Stack component="ol" spacing={0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {entries.map((entry, i) => (
        <Stack component="li" key={entry.id} direction="row" spacing={1.5}>
          <Stack alignItems="center">
            <Avatar
              sx={{
                width: 26,
                height: 26,
                fontSize: 12,
                bgcolor: entry.kind === 'stage_changed' ? 'primary.main' : 'grey.500',
              }}
            >
              {(entry.actor?.name ?? '?')[0]}
            </Avatar>
            {i < entries.length - 1 && <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', my: 0.5 }} />}
          </Stack>
          <Box sx={{ pb: 2, minWidth: 0 }}>
            <Typography variant="body2">
              <strong>{entry.actor?.name ?? 'Someone'}</strong> {describeChange(entry, { fields, users, currency })}
            </Typography>
            <Tooltip title={new Date(entry.createdAt).toLocaleString()}>
              <Typography variant="caption" color="text.secondary">
                {timeAgo(entry.createdAt)}
              </Typography>
            </Tooltip>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
