import { createGraphQLError } from 'graphql-yoga';

type Code = 'BAD_USER_INPUT' | 'NOT_FOUND' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'RATE_LIMITED';

// Errors that are safe to show to the client. They are created through Yoga's
// own helper so they share its graphql instance and pass its error masking;
// anything else reaches the client as "Unexpected error." and internals never leak.
export const appError = (message: string, code: Code) => createGraphQLError(message, { extensions: { code } });

export const notFound = (what: string) => appError(`${what} not found`, 'NOT_FOUND');
export const badInput = (message: string) => appError(message, 'BAD_USER_INPUT');
export const unauthenticated = () => appError('Not signed in', 'UNAUTHENTICATED');
export const rateLimited = (message: string) => appError(message, 'RATE_LIMITED');
