import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type CompanyMembership = { id: string; name: string; cnpj: string | null; logo_url: string | null };

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companies: CompanyMembership[];
  currentCompanyId: string | null;
  roles: string[];
  isManager: boolean;
  isDriverOnly: boolean;
  isSuperAdmin: boolean;
  setCurrentCompany: (id: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const loadCompanies = async (uid: string) => {
    try {
      const { data: sa } = await supabase
        .from("super_admins").select("user_id").eq("user_id", uid).maybeSingle();
      setIsSuperAdmin(!!sa);

      // 1) IDs de empresas onde o usuário é membro (sem join — mais robusto)
      const { data: members, error: memErr } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", uid);
      if (memErr) console.error("[auth] company_members error", memErr);

      const memberIds = Array.from(
        new Set((members ?? []).map((m: any) => m.company_id).filter(Boolean))
      );

      let list: CompanyMembership[] = [];
      if (memberIds.length) {
        const { data: comps, error: cErr } = await supabase
          .from("companies")
          .select("id,name,cnpj,logo_url")
          .in("id", memberIds);
        if (cErr) console.error("[auth] companies error", cErr);
        list = (comps ?? []) as CompanyMembership[];
      }
      setCompanies(list);

      // 2) Empresa atual
      const { data: profile } = await supabase
        .from("profiles").select("current_company_id").eq("id", uid).maybeSingle();
      let current = profile?.current_company_id ?? null;
      if (current && !list.some((c) => c.id === current)) current = null;
      if (!current && list.length) current = list[0].id;

      if (current && current !== profile?.current_company_id) {
        await supabase.from("profiles").update({ current_company_id: current }).eq("id", uid);
      }
      setCurrentCompanyId(current);

      // 3) Roles na empresa atual
      if (current) {
        const { data: rs } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("company_id", current);
        setRoles((rs ?? []).map((r: any) => r.role));
      } else {
        setRoles([]);
      }
    } catch (err) {
      console.error("[auth] loadCompanies failed", err);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          loadCompanies(sess.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setCompanies([]); setCurrentCompanyId(null); setIsSuperAdmin(false);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadCompanies(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const setCurrentCompany = async (id: string) => {
    if (!user) return;
    await supabase.from("profiles").update({ current_company_id: id }).eq("id", user.id);
    setCurrentCompanyId(id);
    const { data: rs } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", id);
    setRoles((rs ?? []).map((r: any) => r.role));
  };

  const refreshCompanies = async () => { if (user) await loadCompanies(user.id); };

  const signOut = async () => { await supabase.auth.signOut(); };

  const isManager = roles.includes("admin") || roles.includes("gestor_frota");
  const isDriverOnly = roles.length > 0 && !isManager && roles.includes("motorista");

  return (
    <AuthContext.Provider value={{ user, session, loading, companies, currentCompanyId, roles, isManager, isDriverOnly, isSuperAdmin, setCurrentCompany, refreshCompanies, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
