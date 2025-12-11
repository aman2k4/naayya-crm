'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  User as SupabaseUser,
  Session,
  AuthChangeEvent,
} from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

interface UserServerData {
  profile: { id: string; email: string; full_name?: string } | null;
  isGlobalAdmin: boolean;
}

interface UserContextType {
  user: SupabaseUser | null;
  logout: () => Promise<void>;
  isLoading: boolean;
  error?: Error | null;
  isGlobalAdmin: boolean;
  profile: { id: string; email: string; full_name?: string } | null;
  isInitialized: boolean;
}

/* -------------------------------------------------------------------------------------------------
 * Context helpers
 * -----------------------------------------------------------------------------------------------*/

const UserContext = createContext<UserContextType | undefined>(undefined);

function useSupabaseClient() {
  const client = useMemo(() => createClient(), []);
  return client;
}

const fetchUserData = async (): Promise<UserServerData> => {
  const res = await fetch('/api/user/me', { credentials: 'include' });
  if (!res.ok) {
    const message = res.status === 401 || res.status === 403 ? 'Unauthorized' : 'Request failed';
    throw new Error(message);
  }
  return res.json();
};

/* -------------------------------------------------------------------------------------------------
 * Provider
 * -----------------------------------------------------------------------------------------------*/

interface UserProviderProps {
  children: ReactNode;
  initialUser?: SupabaseUser | null;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children, initialUser }) => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [user, setUser] = useState<SupabaseUser | null>(initialUser ?? null);
  const [isInitialized, setIsInitialized] = useState(initialUser !== undefined);

  const doLocalCleanup = useCallback(() => {
    queryClient.clear();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {
      /* noop */
    }
  }, [queryClient]);

  const hardRedirectToLogin = useCallback(() => {
    router.replace('/login');
  }, [router]);

  const logout = useCallback(async () => {
    doLocalCleanup();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      hardRedirectToLogin();
    }
  }, [supabase, doLocalCleanup, hardRedirectToLogin]);

  useEffect(() => {
    let cancelled = false;

    if (initialUser === undefined) {
      (async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!cancelled) {
            setUser(data.session?.user ?? null);
          }
        } catch {
          if (!cancelled) {
            setUser(null);
          }
        } finally {
          if (!cancelled) {
            setIsInitialized(true);
          }
        }
      })();
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsInitialized(true);
          return;
        }
        setUser(session?.user ?? null);
        queryClient.invalidateQueries({ queryKey: ['userData'] }).catch(() => {});
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription?.unsubscribe();
    };
  }, [supabase, queryClient, initialUser]);

  const {
    data: userData,
    isLoading: isUserDataLoading,
    error: userDataError,
  } = useQuery<UserServerData, Error>({
    queryKey: ['userData', user?.id],
    queryFn: fetchUserData,
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = !isInitialized || (!!user && isUserDataLoading);

  const contextValue: UserContextType = {
    user,
    logout,
    isLoading,
    error: userDataError ?? null,
    isGlobalAdmin: userData?.isGlobalAdmin ?? false,
    profile: userData?.profile ?? null,
    isInitialized,
  };

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
};

/* -------------------------------------------------------------------------------------------------
 * Hook
 * -----------------------------------------------------------------------------------------------*/

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}
