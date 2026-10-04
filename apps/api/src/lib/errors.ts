import { GraphQLError } from 'graphql';

// Errors that are safe to show to the client. Anything else is masked by Yoga
// as "Unexpected error." so internals never leak.
export class AppError extends GraphQLError {
  constructor(message: string, code: 'BAD_USER_INPUT' | 'NOT_FOUND' | 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(message, { extensions: { code } });
  }
}

export const notFound = (what: string) => new AppError(`${what} not found`, 'NOT_FOUND');
export const badInput = (message: string) => new AppError(message, 'BAD_USER_INPUT');
export const unauthenticated = () => new AppError('Not signed in', 'UNAUTHENTICATED');
