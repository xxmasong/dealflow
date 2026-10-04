import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { BoardDeal, FieldDefinition, Stage } from '../../graphql/types';
import { formatMoney } from '../../lib/format';
import { DealCard } from './DealCard';

interface Props {
  stage: Stage;
  deals: BoardDeal[];
  roundField?: FieldDefinition;
  onOpen: (id: string) => void;
}

export function StageColumn({ stage, deals, roundField, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}`, data: { stageId: stage.id } });
  const total = deals.reduce((sum, d) => sum + d.amountCents, 0);
  const accent = stage.isWon ? 'success.main' : stage.isLost ? 'text.disabled' : 'primary.main';

  return (
    <Paper
      ref={setNodeRef}
      component="section"
      aria-label={stage.name}
      sx={{
        width: 288,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isOver ? 'rgba(31,79,216,0.06)' : '#eceff6',
        borderTop: 3,
        borderColor: accent,
        maxHeight: 'calc(100vh - 180px)',
      }}
    >
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="subtitle1" fontWeight={650}>
            {stage.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {deals.length}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {formatMoney(total)}
        </Typography>
      </Box>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <Stack spacing={1} sx={{ px: 1, pb: 1.5, overflowY: 'auto', minHeight: 80 }}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} roundField={roundField} onOpen={onOpen} />
          ))}
          {deals.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 3 }}>
              Drop deals here
            </Typography>
          )}
        </Stack>
      </SortableContext>
    </Paper>
  );
}
