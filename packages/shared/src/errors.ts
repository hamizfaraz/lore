/** Error codes shared by api (AppError) and web (toasts). Errors return `{ error: { code, message } }`. */
export const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
  UNAVAILABLE: 503,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;
