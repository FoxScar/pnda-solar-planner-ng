import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Role } from '../../shared/domain';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthResult {
  error: { message: string } | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, whatsappNumber?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // /me returns the role from our own profile table, which the auth session does not carry.
  const refresh = useCallback(async () => {
    try {
      const me = await api<AppUser>('/me');
      setUser({ id: me.id, email: me.email, name: me.name, role: me.role });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) return { error: { message: error.message ?? 'Sign in failed' } };
    await refresh();
    return { error: null };
  };

  const signUp = async (email: string, password: string, whatsappNumber?: string): Promise<AuthResult> => {
    const { error } = await authClient.signUp.email({ email, password, name: email.split('@')[0] });
    if (error) return { error: { message: error.message ?? 'Sign up failed' } };
    if (whatsappNumber) {
      try {
        await api('/me/profile', { method: 'PATCH', json: { whatsappNumber } });
      } catch {
        // Account exists; the number can be added later from the profile page.
      }
    }
    await refresh();
    return { error: null };
  };

  const signOut = async () => {
    await authClient.signOut({});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};
