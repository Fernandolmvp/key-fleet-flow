import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Layers, Building2, DollarSign, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Group = {
  id: string;
  name: string;
  owner_user_id: string;
  extra_company_fee: number;
  owner_email?: string | null;
  owner_name?: string | null;
  companies: { id: string; name: string }[];
  base_amount: number;
  monthly_total: number;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CompanyGroupsPanel() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; fee: string }>({ name: "", fee: "" });

  const load = async () => {
    setLoading(true);
    try {
      const { data: gs, error } = await supabase
        .from("company_groups")
        .select("id, name, owner_user_id, extra_company_fee")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const groupIds = (gs ?? []).map((g) => g.id);
      const ownerIds = [...new Set((gs ?? []).map((g) => g.owner_user_id))];

      const [{ data: comps }, { data: profiles }, { data: subs }] = await Promise.all([
        supabase.from("companies").select("id, name, group_id").in("group_id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("profiles").select("id, full_name").in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("subscriptions")
          .select("group_id, plan_id, status, plans(monthly_price)")
          .in("group_id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"])
          .in("status", ["ativa", "aguardando_pagamento", "trial"]),
      ]);

      const compsByGroup: Record<string, { id: string; name: string }[]> = {};
      (comps ?? []).forEach((c: any) => {
        if (!compsByGroup[c.group_id]) compsByGroup[c.group_id] = [];
        compsByGroup[c.group_id].push({ id: c.id, name: c.name });
      });
      const profById: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { profById[p.id] = p.full_name ?? ""; });
      const subByGroup: Record<string, number> = {};
      (subs ?? []).forEach((s: any) => {
        if (!subByGroup[s.group_id]) subByGroup[s.group_id] = s.plans?.monthly_price ?? 99.9;
      });

      const enriched: Group[] = (gs ?? []).map((g: any) => {
        const cs = compsByGroup[g.id] ?? [];
        const base = subByGroup[g.id] ?? 99.9;
        const extra = Number(g.extra_company_fee ?? 30);
        const total = base + Math.max(cs.length - 1, 0) * extra;
        return {
          id: g.id,
          name: g.name,
          owner_user_id: g.owner_user_id,
          extra_company_fee: extra,
          owner_name: profById[g.owner_user_id] ?? null,
          companies: cs,
          base_amount: base,
          monthly_total: total,
        };
      });
      setGroups(enriched);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (g: Group) => {
    setEditing(g.id);
    setEditValues({ name: g.name, fee: String(g.extra_company_fee) });
  };

  const saveEdit = async (id: string) => {
    const fee = Number(editValues.fee.replace(",", "."));
    if (Number.isNaN(fee) || fee < 0) return toast.error("Taxa inválida");
    if (!editValues.name.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase
      .from("company_groups")
      .update({ name: editValues.name.trim(), extra_company_fee: fee })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Grupo atualizado");
    setEditing(null);
    load();
  };

  const groupMRR = groups.reduce((s, g) => s + g.monthly_total, 0);

  if (loading) {
    return (
      <div className="surface-card rounded-xl p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Grupos</div>
          <div className="text-2xl font-display font-bold mt-1">{groups.length}</div>
        </div>
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Empresas vinculadas</div>
          <div className="text-2xl font-display font-bold mt-1">
            {groups.reduce((s, g) => s + g.companies.length, 0)}
          </div>
        </div>
        <div className="surface-card rounded-xl p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">MRR consolidado</div>
          <div className="text-2xl font-display font-bold text-success mt-1">{fmtBRL(groupMRR)}</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum grupo cadastrado</h3>
          <p className="text-sm text-muted-foreground">Grupos são criados automaticamente quando uma empresa é cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="surface-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editing === g.id ? (
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input
                        value={editValues.name}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                        className="max-w-xs"
                        placeholder="Nome do grupo"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Taxa por empresa extra:</span>
                        <Input
                          value={editValues.fee}
                          onChange={(e) => setEditValues((v) => ({ ...v, fee: e.target.value }))}
                          className="w-28"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Layers className="h-4 w-4 text-primary" />
                        <span className="font-display font-semibold">{g.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {g.companies.length} {g.companies.length === 1 ? "empresa" : "empresas"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Titular: {g.owner_name || g.owner_user_id.slice(0, 8)}
                      </div>
                    </>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 justify-end">
                    <DollarSign className="h-3 w-3" /> Mensalidade
                  </div>
                  <div className="text-lg font-display font-bold text-success">{fmtBRL(g.monthly_total)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {fmtBRL(g.base_amount)} base + {Math.max(g.companies.length - 1, 0)} × {fmtBRL(g.extra_company_fee)}
                  </div>
                </div>

                <div className="shrink-0">
                  {editing === g.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => saveEdit(g.id)}><Save className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.companies.map((c) => (
                  <Badge key={c.id} variant="secondary" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" /> {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}