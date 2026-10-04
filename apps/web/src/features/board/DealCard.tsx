import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, Box, Card, CardActionArea, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { memo } from 'react';
import type { BoardDeal, FieldDefinition } from '../../graphql/types';
import { formatMoney, timeAgo } from '../../lib/format';

interface Props {
  deal: BoardDeal;
  roundField?: FieldDefinition;
  onOpen: (id: string) => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const DealCardBody = memo(function DealCardBody({ deal, roundField }: Omit<Props, 'onOpen'>) {
  const round = roundField && deal.fields.find((f) => f.field.id === roundField.id)?.value;
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" noWrap title={deal.company}>
        {deal.company}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap title={deal.name}>
        {deal.name}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
        <Typography variant="body2" fontWeight={650}>
          {formatMoney(deal.amountCents, deal.currency)}
        </Typography>
        {round ? <Chip size="small" label={String(round)} variant="outlined" /> : null}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {timeAgo(deal.updatedAt)}
        </Typography>
        {deal.owner && (
          <Tooltip title={deal.owner.name}>
            <Avatar sx={{ width: 22, height: 22, fontSize: 11 }}>{initials(deal.owner.name)}</Avatar>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
});

export function DealCard({ deal, roundField, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { stageId: deal.stage.id },
  });

  return (
    <Card
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        cursor: 'grab',
        '&:hover': { borderColor: 'primary.light' },
      }}
      {...attributes}
      {...listeners}
    >
      <CardActionArea onClick={() => onOpen(deal.id)} disableRipple aria-label={`Open ${deal.company}`}>
        <DealCardBody deal={deal} roundField={roundField} />
      </CardActionArea>
    </Card>
  );
}
