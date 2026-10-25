import { describe, expect, it } from 'vitest';
import {
  bearerToken,
  generatePat,
  hashPat,
  requireConfirmedWrite,
  requireScope,
  sanitizeAuditInput,
} from './policy';

describe('MCP authorization policy', () => {
  it('generates a 32-character base62 credential and hashes it irreversibly', () => {
    const token = generatePat();
    expect(token).toMatch(/^lore_pat_[A-Za-z0-9]{32}$/);
    expect(hashPat(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPat(token)).not.toContain(token);
  });

  it('accepts only the complete Bearer credential shape', () => {
    const token = generatePat();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(() => bearerToken(token)).toThrow();
    expect(() => bearerToken('Bearer lore_pat_too-short')).toThrow();
  });

  it('rejects scope violations and unconfirmed writes', () => {
    expect(() => requireScope(['read'], 'plans:write')).toThrowError(/plans:write/);
    expect(() => requireConfirmedWrite({ confirm: false })).toThrowError(/confirm: true/);
    expect(() => requireConfirmedWrite({ confirm: true })).not.toThrow();
  });

  it('redacts credentials and prose while retaining ids and control values', () => {
    const token = generatePat();
    const sanitized = sanitizeAuditInput({
      token,
      conversationId: 'conversation-1',
      confirm: true,
      caption: 'private words',
      nested: { message: 'more private words', candidateId: 'candidate-1' },
    });
    expect(JSON.stringify(sanitized)).not.toContain(token);
    expect(JSON.stringify(sanitized)).not.toContain('private words');
    expect(sanitized).toEqual({
      token: '[redacted]',
      conversationId: 'conversation-1',
      confirm: true,
      caption: '[redacted]',
      nested: { message: '[redacted]', candidateId: 'candidate-1' },
    });
  });
});
