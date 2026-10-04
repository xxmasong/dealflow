import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BOARD, CREATE_DEAL, MOVE_DEAL } from '../../graphql/documents';
import type { BoardDeal, FieldDefinition, Stage, User } from '../../graphql/types';
import { request } from '../../lib/api';
import { useNotify } from '../../components/Notifier';
import { applyMove, type MovePlan } from './boardModel';

export interface BoardData {
  stages: Stage[];
  users: User[];
  fieldDefinitions: FieldDefinition[];
  deals: BoardDeal[];
}

export const boardKey = (search: string) => ['board', search] as const;

export function useBoard(search: string) {
  return useQuery({
    queryKey: boardKey(search),
    queryFn: () => request<BoardData>(BOARD, { search: search || null }),
    placeholderData: (previous) => previous,
  });
}

/** Moves a card immediately, then reconciles with the server (or rolls back). */
export function useMoveDeal(search: string) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const key = boardKey(search);

  return useMutation({
    mutationFn: (plan: MovePlan) =>
      request(MOVE_DEAL, {
        id: plan.dealId,
        stageId: plan.stageId,
        afterDealId: plan.afterDealId,
        beforeDealId: plan.beforeDealId,
      }),
    onMutate: async (plan) => {
      await queryClient.cancelQueries({ queryKey: ['board'] });
      const previous = queryClient.getQueryData<BoardData>(key);
      if (previous) queryClient.setQueryData<BoardData>(key, { ...previous, deals: applyMove(previous.deals, plan) });
      return { previous };
    },
    onError: (err, _plan, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      notify(err instanceof Error ? err.message : 'Could not move the deal', 'error');
    },
    onSettled: (_data, _err, plan) => {
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      void queryClient.invalidateQueries({ queryKey: ['report'] });
      void queryClient.invalidateQueries({ queryKey: ['deal', plan.dealId] });
    },
  });
}

export interface NewDeal {
  name: string;
  company: string;
  amountCents: number;
  currency: string;
  stageId: string;
  ownerId: string | null;
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewDeal) => request<{ createDeal: BoardDeal }>(CREATE_DEAL, { input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      void queryClient.invalidateQueries({ queryKey: ['report'] });
    },
  });
}
