// Shapes returned by the queries in documents.ts.

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'metric';
export type HistoryKind = 'created' | 'stage_changed' | 'attribute_changed' | 'field_changed';
export type FieldValue = string | number | null;

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Stage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface FieldDefinition {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  unit: string | null;
  position: number;
  archived: boolean;
}

export interface BoardDeal {
  id: string;
  name: string;
  company: string;
  amountCents: number;
  currency: string;
  position: string;
  updatedAt: string;
  stage: { id: string };
  owner: { id: string; name: string } | null;
  fields: Array<{ field: { id: string; key: string }; value: FieldValue }>;
}

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  field: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

export interface DealDetail extends BoardDeal {
  createdAt: string;
  stage: Stage;
  history: HistoryEntry[];
}

export interface PipelineReport {
  winRate: number | null;
  stages: Array<{ stage: Stage; dealCount: number; amountCents: number }>;
  flows: Array<{ fromStage: string | null; toStage: string; count: number }>;
  activity: Array<{ date: string; created: number; moved: number; edited: number }>;
}
