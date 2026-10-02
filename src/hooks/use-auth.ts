// =============================================================================
// HOOKS AUTH - Digit PRESSING (Supabase Auth Wrapper)
// =============================================================================

'use client';

import { useRouter } from 'next/navigation';
import { useAuth as useSupabaseAuth, useAuthActions as useSupabaseAuthActions } from '@/store/auth';

export const useAuth = () => {
  const router = useRouter();
  const { user, session, isLoading } = useSupabaseAuth();
  const { signIn, signOut } = useSupabaseAuthActions();

  const login = async (email: string, password: string) => {
    await signIn(email, password);
    router.push('/dashboard');
  };

  const logout = async () => {
    await signOut();
    router.push('/');
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
};
