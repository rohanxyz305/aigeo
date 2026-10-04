import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'arc-session';
const AuthContext = createContext(null);

function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return session?.token ? session : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const signIn = useCallback((session) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
    setUser(session);
  }, []);

  const signOut = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
