import { createHash, randomBytes } from 'node:crypto';
import type { TokenScope } from '@lore/shared/enums';
import { badRequest, forbidden, unauthorized } from '../../lib/errors';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SECRET_LENGTH = 32;

/** Generate 32 unbiased base62 characters without ever logging the credential. */
export function generatePat(): string {
  let secret = '';
  while (secret.length < SECRET_LENGTH) {
    for (const byte of randomBytes(SECRET_LENGTH)) {
      if (byte >= 248) continue;
      secret += BASE62[byte % BASE62.length];
      if (secret.length === SECRET_LENGTH) break;
    }
  }
  return `lore_pat_${secret}`;
}

export function hashPat(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function bearerToken(header: string | undefined): string {
  const match = /^Bearer\s+(lore_pat_[A-Za-z0-9]{32})$/i.exec(header?.trim() ?? '');
  if (!match) throw unauthorized('A valid LORE personal access token is required');
  return match[1]!;
}

export function requireScope(scopes: TokenScope[], scope: TokenScope): void {
  if (!scopes.includes(scope)) throw forbidden(`The token requires the ${scope} scope`);
}

export function requireConfirmedWrite(input: Record<string, unknown>): void {
  if (input.confirm !== true) throw badRequest('Set confirm: true to authorize this write');
}

const SENSITIVE_KEY = /(token|secret|password|authorization|caption|message|prompt|body|text)/i;

/** Keep identifiers and control values useful for audits while stripping credentials and prose. */
export function sanitizeAuditInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditInput);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[redacted]' : sanitizeAuditInput(entry),
    ]),
  );
}
