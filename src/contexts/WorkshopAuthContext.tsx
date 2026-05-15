import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type WUser = { id: string; name: string; email: string; role?: string };
type WShop = { id: string; name: string; document_number?: string; city?: string; state?: string };

type Ctx = {
  token: string | null;
  user: WUser | null;
  workshop: WShop | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setSession: (s: { token: string; user: WUser; workshop: WShop }) => void;
  authedFetch: <T = any>(fn: string, init?: RequestInit) => Promise<T>;
};

const WorkshopAuthContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "workshop_session_v1";

export function WorkshopAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<WUser | null>(null);
  const [workshop, setWorkshop] = useState<WShop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setToken(s.token); setUser(s.user); setWorkshop(s.workshop);
      }
    } catch {}
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.functions.invoke("workshop-login", {
      body: { email, password },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    const session = data as { token: string; user: WUser; workshop: WShop };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setToken(session.token); setUser(session.user); setWorkshop(session.workshop);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null); setUser(null); setWorkshop(null);
  }, []);

  const setSession = useCallback((s: { token: string; user: WUser; workshop: WShop }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setToken(s.token); setUser(s.user); setWorkshop(s.workshop);
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
    <WorkshopAuthContext.Provider value={{ token, user, workshop, loading, login, logout, setSession, authedFetch }}>
      {children}
    </WorkshopAuthContext.Provider>
  );
}

export function useWorkshopAuth() {
  const ctx = useContext(WorkshopAuthContext);
  if (!ctx) throw new Error("useWorkshopAuth fora do provider");
  return ctx;
}