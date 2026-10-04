import { gql } from 'graphql-request';

const BOARD_DEAL = gql`
  fragment BoardDeal on Deal {
    id
    name
    company
    amountCents
    currency
    position
    updatedAt
    stage {
      id
    }
    owner {
      id
      name
    }
    fields {
      field {
        id
        key
      }
      value
    }
  }
`;

const FIELD_DEFINITION = gql`
  fragment FieldDefinitionParts on FieldDefinition {
    id
    key
    label
    type
    options
    unit
    position
    archived
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
        email
      }
    }
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      name
      email
    }
  }
`;

export const BOARD = gql`
  ${BOARD_DEAL}
  ${FIELD_DEFINITION}
  query Board($search: String) {
    stages {
      id
      name
      position
      isWon
      isLost
    }
    users {
      id
      name
      email
    }
    fieldDefinitions {
      ...FieldDefinitionParts
    }
    deals(search: $search) {
      ...BoardDeal
    }
  }
`;

export const DEAL = gql`
  ${BOARD_DEAL}
  query Deal($id: ID!) {
    deal(id: $id) {
      ...BoardDeal
      createdAt
      stage {
        id
        name
        position
        isWon
        isLost
      }
      history {
        id
        kind
        field
        oldValue
        newValue
        createdAt
        actor {
          id
          name
        }
      }
    }
  }
`;

export const CREATE_DEAL = gql`
  ${BOARD_DEAL}
  mutation CreateDeal($input: CreateDealInput!) {
    createDeal(input: $input) {
      ...BoardDeal
    }
  }
`;

export const UPDATE_DEAL = gql`
  ${BOARD_DEAL}
  mutation UpdateDeal($id: ID!, $input: UpdateDealInput!) {
    updateDeal(id: $id, input: $input) {
      ...BoardDeal
    }
  }
`;

export const MOVE_DEAL = gql`
  ${BOARD_DEAL}
  mutation MoveDeal($id: ID!, $stageId: ID!, $afterDealId: ID, $beforeDealId: ID) {
    moveDeal(id: $id, stageId: $stageId, afterDealId: $afterDealId, beforeDealId: $beforeDealId) {
      ...BoardDeal
    }
  }
`;

export const SET_FIELD_VALUE = gql`
  ${BOARD_DEAL}
  mutation SetFieldValue($dealId: ID!, $fieldId: ID!, $value: JSON) {
    setFieldValue(dealId: $dealId, fieldId: $fieldId, value: $value) {
      ...BoardDeal
    }
  }
`;

export const FIELD_DEFINITIONS = gql`
  ${FIELD_DEFINITION}
  query FieldDefinitions {
    fieldDefinitions(includeArchived: true) {
      ...FieldDefinitionParts
    }
  }
`;

export const CREATE_FIELD = gql`
  ${FIELD_DEFINITION}
  mutation CreateField($input: CreateFieldInput!) {
    createField(input: $input) {
      ...FieldDefinitionParts
    }
  }
`;

export const UPDATE_FIELD = gql`
  ${FIELD_DEFINITION}
  mutation UpdateField($id: ID!, $input: UpdateFieldInput!) {
    updateField(id: $id, input: $input) {
      ...FieldDefinitionParts
    }
  }
`;

export const ARCHIVE_FIELD = gql`
  ${FIELD_DEFINITION}
  mutation ArchiveField($id: ID!, $archived: Boolean!) {
    archiveField(id: $id, archived: $archived) {
      ...FieldDefinitionParts
    }
  }
`;

export const REPORT = gql`
  query Report($days: Int!) {
    report {
      winRate
      stages {
        stage {
          id
          name
          position
          isWon
          isLost
        }
        dealCount
        amountCents
      }
      flows(days: $days) {
        fromStage
        toStage
        count
      }
      activity(days: $days) {
        date
        created
        moved
        edited
      }
    }
  }
`;
