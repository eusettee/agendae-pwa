import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearSession, onSessionExpired, restoreSession, saveSession } from '../services/api';
import { User } from '../types';

type Session = { user: User | null; loading: boolean; error: string; reconnect: () => Promise<void>; authenticate: (input: Record<string, unknown>) => Promise<void>; logout: () => Promise<void> };
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reconnect = useCallback(async () => {
    try {
      const status = await api<{ accounts: boolean; database: string }>('status');
      if (!status.accounts || status.database !== 'firestore') throw new Error('O banco Firebase ainda precisa ser ativado no servidor.');
      if (await restoreSession()) setUser((await api<{ user: User }>('mobile-auth')).user);
      setError('');
    } catch (failure) { setError((failure as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    onSessionExpired(() => setUser(null));
    const timer = setTimeout(() => { void reconnect(); }, 0);
    return () => { clearTimeout(timer); onSessionExpired(() => {}); };
  }, [reconnect]);
  async function authenticate(input: Record<string, unknown>) {
    const status = await api<{ database: string }>('status');
    if (status.database !== 'firestore') throw new Error('Configure o Firebase no servidor antes de entrar.');
    const result = await api<{ user: User; token: string }>('mobile-auth', 'POST', input);
    await saveSession(result.token); setUser(result.user); setError('');
  }
  async function logout() {
    await api('mobile-auth', 'POST', { action: 'logout' });
    await clearSession(); setUser(null);
  }
  return <Context.Provider value={{ user, loading, error, reconnect, authenticate, logout }}>{children}</Context.Provider>;
}
export function useSession() { const session = useContext(Context); if (!session) throw new Error('SessionProvider ausente.'); return session; }
