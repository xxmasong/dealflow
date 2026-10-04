import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, Card, InputAdornment, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatMoney } from '../../lib/format';
import { DealDrawer } from '../deal/DealDrawer';
import { buildColumns, planMove } from './boardModel';
import { DealCardBody } from './DealCard';
import { NewDealDialog } from './NewDealDialog';
import { StageColumn } from './StageColumn';
import { useBoard, useMoveDeal } from './useBoard';

export function BoardPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const board = useBoard(deferredSearch);
  const move = useMoveDeal(deferredSearch);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const openDealId = params.get('deal');
  const openDeal = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('deal', id);
    else next.delete('deal');
    setParams(next, { replace: true });
  };

  const data = board.data;
  const columns = useMemo(() => (data ? buildColumns(data.stages, data.deals) : {}), [data]);
  const roundField = data?.fieldDefinitions.find((f) => f.key === 'round');
  const activeDeal = data?.deals.find((d) => d.id === activeId);
  const openTotal = data?.deals
    .filter((d) => !data.stages.find((s) => s.id === d.stage.id && (s.isWon || s.isLost)))
    .reduce((sum, d) => sum + d.amountCents, 0);

  const sensors = useSensors(
    // A small distance lets a click open the card instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || !data) return;
    const dealId = String(active.id);
    const overId = String(over.id);

    let stageId: string;
    let index: number;
    if (overId.startsWith('stage:')) {
      stageId = overId.slice('stage:'.length);
      index = (columns[stageId] ?? []).filter((d) => d.id !== dealId).length;
    } else {
      const overDeal = data.deals.find((d) => d.id === overId);
      if (!overDeal) return;
      stageId = overDeal.stage.id;
      // Dropping on a card takes its slot; in the same column that matches
      // arrayMove semantics whether the card moved up or down.
      index = (columns[stageId] ?? []).findIndex((d) => d.id === overId);
    }

    const plan = planMove(columns, dealId, { stageId, index });
    if (plan) move.mutate(plan);
  };

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Pipeline</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.deals.length} deals · ${formatMoney(openTotal ?? 0)} open` : ' '}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search deals or companies"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { sm: 280 } }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)} disabled={!data}>
          New deal
        </Button>
      </Stack>

      {board.error && <Alert severity="error">{board.error.message}</Alert>}

      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        {!data ? (
          <Stack direction="row" spacing={2}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" width={288} height={420} />
            ))}
          </Stack>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              {data.stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  deals={columns[stage.id] ?? []}
                  roundField={roundField}
                  onOpen={openDeal}
                />
              ))}
            </Stack>
            <DragOverlay>
              {activeDeal ? (
                <Card sx={{ width: 272, boxShadow: 6, cursor: 'grabbing' }}>
                  <DealCardBody deal={activeDeal} roundField={roundField} />
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      {data && (
        <NewDealDialog
          open={creating}
          stages={data.stages}
          users={data.users}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            openDeal(id);
          }}
        />
      )}
      <DealDrawer dealId={openDealId} onClose={() => openDeal(null)} />
    </Stack>
  );
}
