import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type PostoUser = { id: string; name: string; email: string };
type PostoStation = { id: string; name: string; cnpj?: string; city?: string; state?: string };

type Ctx = {
  token: string | null;
  user: PostoUser | null;
  station: PostoStation | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setSession: (s: { token: string; user: PostoUser; station: PostoStation }) => void;
  authedFetch: <T = any>(fn: string, init?: RequestInit) => Promise<T>;
};

const PostoAuthContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "posto_session_v1";

export function PostoAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PostoUser | null>(null);
  const [station, setStation] = useState<PostoStation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setToken(s.token); setUser(s.user); setStation(s.station);
      }
    } catch {}
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.functions.invoke("posto-login", {
      body: { email, password },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    const session = data as { token: string; user: PostoUser; station: PostoStation };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setToken(session.token); setUser(session.user); setStation(session.station);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null); setUser(null); setStation(null);
  }, []);

  const setSession = useCallback((s: { token: string; user: PostoUser; station: PostoStation }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setToken(s.token); setUser(s.user); setStation(s.station);
  }, []);

  const authedFetch = useCallback(async <T,>(fn: string, init?: RequestInit) => {
    if (!token) throw new Error("Sem sessão");
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      },
    });
    const json = await res.json();
    if (!res.ok || json?.error) {
      if (res.status === 401) logout();
      throw new Error(json?.error ?? `HTTP ${res.status}`);
    }
    return json as T;
  }, [token, logout]);

  return (
    <PostoAuthContext.Provider value={{ token, user, station, loading, login, logout, setSession, authedFetch }}>
      {children}
    </PostoAuthContext.Provider>
  );
}

export function usePostoAuth() {
  const ctx = useContext(PostoAuthContext);
  if (!ctx) throw new Error("usePostoAuth fora do provider");
  return ctx;
}