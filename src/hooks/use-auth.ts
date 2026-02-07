'use client';

import { login as authLogin } from '@/lib/auth';
import { useStore } from '@/lib/store/use-store';
import { useCallback } from 'react';

/**
 * Auth hook for managing user authentication state
 */
export function useAuth() {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.login);
  const clearUser = useStore((state) => state.logout);

  const isAuthenticated = user !== null;

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authLogin(email, password);

      if (result.success) {
        setUser({
          id: result.user.id,
          name: result.user.fullName,
          role: result.user.role,
        });
        return { success: true as const };
      }

      return { success: false as const, error: result.error };
    },
    [setUser]
  );

  /**
   * Logout current user
   */
  const logout = useCallback(() => {
    clearUser();
  }, [clearUser]);

  return {
    user,
    isAuthenticated,
    login,
    logout,
  };
}
