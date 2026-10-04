import { ClientError, GraphQLClient, type RequestDocument, type Variables } from 'graphql-request';

const TOKEN_KEY = 'dealflow.token';

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage can be unavailable (private mode); the session then lasts until reload.
    }
  },
};

const client = new GraphQLClient(new URL('/graphql', window.location.origin).toString());

let onUnauthenticated: () => void = () => {};
export const setUnauthenticatedHandler = (fn: () => void) => {
  onUnauthenticated = fn;
};

/** Error carrying the first GraphQL error message, ready to show in the UI. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function request<T>(document: RequestDocument, variables?: Variables): Promise<T> {
  const token = tokenStore.get();
  try {
    return await client.request<T>({
      document,
      variables,
      requestHeaders: token ? { authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    if (err instanceof ClientError) {
      const first = err.response.errors?.[0];
      const code = first?.extensions?.code as string | undefined;
      if (code === 'UNAUTHENTICATED' && token) onUnauthenticated();
      throw new ApiError(first?.message ?? 'Request failed', code);
    }
    throw new ApiError('Could not reach the server');
  }
}
