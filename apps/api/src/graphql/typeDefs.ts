export const typeDefs = /* GraphQL */ `
  scalar JSON
  scalar DateTime

  enum FieldType {
    text
    number
    date
    select
    metric
  }

  enum HistoryKind {
    created
    stage_changed
    attribute_changed
    field_changed
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Stage {
    id: ID!
    name: String!
    position: Int!
    isWon: Boolean!
    isLost: Boolean!
  }

  type FieldDefinition {
    id: ID!
    key: String!
    label: String!
    type: FieldType!
    options: [String!]!
    unit: String
    position: Int!
    archived: Boolean!
  }

  type FieldValue {
    field: FieldDefinition!
    value: JSON
  }

  type Deal {
    id: ID!
    name: String!
    company: String!
    "Amount in minor units (cents)."
    amountCents: Float!
    currency: String!
    stage: Stage!
    owner: User
    "Sort key within the stage column."
    position: String!
    fields: [FieldValue!]!
    history: [HistoryEntry!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type HistoryEntry {
    id: ID!
    kind: HistoryKind!
    field: String
    oldValue: JSON
    newValue: JSON
    actor: User
    createdAt: DateTime!
  }

  type StageSummary {
    stage: Stage!
    dealCount: Int!
    amountCents: Float!
  }

  type StageFlow {
    fromStage: String
    toStage: String!
    count: Int!
  }

  type ActivityPoint {
    date: String!
    created: Int!
    moved: Int!
    edited: Int!
  }

  type PipelineReport {
    stages: [StageSummary!]!
    flows(days: Int = 30): [StageFlow!]!
    activity(days: Int = 30): [ActivityPoint!]!
    "Share of closed deals that were won; null until a deal is closed."
    winRate: Float
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User!
    users: [User!]!
    stages: [Stage!]!
    deals(stageId: ID, search: String): [Deal!]!
    deal(id: ID!): Deal!
    fieldDefinitions(includeArchived: Boolean = false): [FieldDefinition!]!
    report: PipelineReport!
  }

  input CreateDealInput {
    name: String!
    company: String!
    amountCents: Float
    currency: String
    stageId: ID!
    ownerId: ID
  }

  input UpdateDealInput {
    name: String
    company: String
    amountCents: Float
    currency: String
    ownerId: ID
  }

  input CreateFieldInput {
    label: String!
    type: FieldType!
    options: [String!]
    unit: String
  }

  input UpdateFieldInput {
    label: String
    options: [String!]
    unit: String
    position: Int
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createDeal(input: CreateDealInput!): Deal!
    updateDeal(id: ID!, input: UpdateDealInput!): Deal!
    "Move a deal to a stage, between the deal above it (afterDealId) and below it (beforeDealId)."
    moveDeal(id: ID!, stageId: ID!, afterDealId: ID, beforeDealId: ID): Deal!
    setFieldValue(dealId: ID!, fieldId: ID!, value: JSON): Deal!
    createField(input: CreateFieldInput!): FieldDefinition!
    updateField(id: ID!, input: UpdateFieldInput!): FieldDefinition!
    archiveField(id: ID!, archived: Boolean = true): FieldDefinition!
  }
`;
