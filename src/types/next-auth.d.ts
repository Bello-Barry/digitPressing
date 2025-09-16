
// =============================================================================
// TYPES NEXTAUTH ÉTENDUS
// =============================================================================

// src/types/next-auth.d.ts
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      pressingId: string;
      pressingName: string;
      permissions: Permission[];
    } & DefaultSession['user'];
    supabaseAccessToken: string;
  }

  interface User extends DefaultUser {
    role: string;
    pressingId: string;
    pressingName: string;
    permissions: Permission[];
    supabaseAccessToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    pressingId: string;
    pressingName: string;
    permissions: Permission[];
    supabaseAccessToken: string;
  }
}
