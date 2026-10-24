'use client';
import { createAuthClient } from 'better-auth/react';

/** Better Auth client; basePath matches the api (`/api/auth`, same-origin). */
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin,
  basePath: '/api/auth',
});
