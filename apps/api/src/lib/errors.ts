import { ERROR_CODES, type ErrorCode } from '@lore/shared/errors';
import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** One error class with codes; errors render as `{ error: { code, message } }` (section 4). */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
  get status() {
    return ERROR_CODES[this.code];
  }
}

/** Thrown by cross-boundary stubs until their owner implements them (section 6). */
export class NotImplemented extends AppError {
  constructor(fn: string) {
    super('NOT_IMPLEMENTED', `${fn} is not implemented yet`);
    this.name = 'NotImplemented';
  }
}

export const forbidden = (m = 'Forbidden') => new AppError('FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m);
export const badRequest = (m = 'Bad request', details?: unknown) => new AppError('BAD_REQUEST', m, details);
export const unauthorized = (m = 'Sign in required') => new AppError('UNAUTHORIZED', m);
export const conflict = (m = 'Conflict') => new AppError('CONFLICT', m);

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'unhandled error');
    return reply.status(status).send({
      error: {
        code: status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'INTERNAL' : 'BAD_REQUEST',
        message: status >= 500 ? 'Something went wrong' : err.message,
      },
    });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );
}
