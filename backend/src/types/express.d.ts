import type { Role } from '../types/auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  status: 'active' | 'suspended';
  emailVerifiedAt: string | null;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      validated: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      auth?: AuthenticatedUser;
    }
  }
}

export {};
