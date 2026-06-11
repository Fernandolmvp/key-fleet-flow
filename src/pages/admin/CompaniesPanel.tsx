import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Search, DollarSign, Users, Truck, AlertTriangle,
  CheckCircle2, Pencil, Receipt, Loader2, Layers, ChevronDown, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import CompanyMembersDialog from "./CompanyMembersDialog";
import GroupInfoDialog from "./GroupInfoDialog";

type Plan = {
  id: string; slug: string; name: string;
  vehicle_limit: number | null; monthly_price: number | null;
  is_custom: boolean; features: string[]; sort_order: number; active: boolean;
};

type Usage = {
  company_id: string; company_name: string; cnpj: string | null;
  company_created_at: string;
  subscription_id: string; subscription_status: string;
  current_period_end: string;
  monthly_amount: number | null;
  suspended_at: string | null; cancelled_at: string | null;
  plan_id: string; plan_slug: string; plan_name: string;
  vehicle_limit: number | null;
  vehicles_used: number; drivers_count: number; members_count: number;
  last_payment_at: string | null;
};

const statusTone: Record<string, string> = {
  ativa: "bg-success/20 text-success border-success/30",
  aguardando_pagamento: "bg-warning/20 text-warning border-warning/30",
  atrasada: "bg-destructive/20 text-destructive border-destructive/30",
  suspensa: "bg-destructive/30 text-destructive border-destructive/40",
  cancelada: "bg-muted text-muted-foreground",
  trial: "bg-primary/15 text-primary border-primary/30",
  trial_expirado: "bg-destructive/20 text-destructive border-destructive/30",
};
const statusLabel: Record<string, string> = {
  ativa: "Ativa", aguardando_pagamento: "Aguardando", atrasada: "Atrasada",
  suspensa: "Suspensa", cancelada: "Cancelada",
  trial: "Trial", trial_expirado: "Trial expirado", expirada: "Trial expirado",
};

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function CompaniesPanel() {
  const [items, setItems] = useState<Usage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("todas");
  const [editing, setEditing] = useState<Usage | null>(null);
  const [paying, setPaying] = useState<Usage | null>(null);
  const [membersOf, setMembersOf] = useState<Usage | null>(null);
  const [groupInfo, setGroupInfo] = useState<string | null>(null);
  const [companyMeta, setCompanyMeta] = useState<Record<string, { group_id: string | null; is_primary: boolean }>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: u, error: eu }, { data: p, error: ep }] = await Promise.all([
      supabase.from("company_usage").select("*").order("company_created_at", { ascending: false }),
      supabase.from("plans").select("*").order("sort_order"),
    ]);
    if (eu) toast.error(eu.message);
    if (ep) toast.error(ep.message);
    setItems((u ?? []) as any);
    setPlans((p ?? []) as any);

    // Mapeia cada empresa -> group_id + se é a principal (mais antiga do grupo)
    const { data: comps } = await supabase
      .from("companies")
      .select("id, group_id, created_at")
      .order("created_at", { ascending: true });
    const firstByGroup: Record<string, string> = {};
    (comps ?? []).forEach((c: any) => {
      if (c.group_id && !firstByGroup[c.group_id]) firstByGroup[c.group_id] = c.id;
    });
    const meta: Record<string, { group_id: string | null; is_primary: boolean }> = {};
    (comps ?? []).forEach((c: any) => {
      meta[c.id] = {
        group_id: c.group_id ?? null,
        is_primary: !!c.group_id && firstByGroup[c.group_id] === c.id,
      };
    });
    setCompanyMeta(meta);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isTrialExpired = (i: Usage) =>
    (i.subscription_status === "trial" || i.subscription_status === "expirada") &&
    !!i.current_period_end &&
    new Date(i.current_period_end) < new Date();
  const isTrialActive = (i: Usage) =>
    i.subscription_status === "trial" && !isTrialExpired(i);
  const trialDaysLeft = (i: Usage) => {
    if (!i.current_period_end) return 0;
    const ms = new Date(i.current_period_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  };

  const byTab = items.filter((i) => {
    if (tab === "todas") return true;
    if (tab === "ativas") return i.subscription_status === "ativa";
    if (tab === "trial") return isTrialActive(i);
    if (tab === "trial_expirado") return isTrialExpired(i);
    if (tab === "aguardando") return i.subscription_status === "aguardando_pagamento";
    if (tab === "atrasadas") return ["atrasada","suspensa"].includes(i.subscription_status);
    if (tab === "canceladas") return i.subscription_status === "cancelada";
    return true;
  });

  const filtered = byTab.filter((i) => {
    if (!q.trim()) return true;
    const hay = `${i.company_name} ${i.cnpj ?? ""} ${i.plan_name}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  // Filhas indexadas por group_id
  const childrenByGroup: Record<string, Usage[]> = {};
  for (const i of filtered) {
    const cm = companyMeta[i.company_id];
    if (cm?.group_id && !cm.is_primary) {
      (childrenByGroup[cm.group_id] ??= []).push(i);
    }
  }
  // Lista principal: matrizes + empresas sem grupo
  // (busca também respeita filhas — se houver match em filha sem matriz visível, ainda assim mostra a matriz)
  const visibleParents = filtered.filter((i) => {
    const cm = companyMeta[i.company_id];
    return !cm?.group_id || cm.is_primary;
  });

  const mrr = items
    .filter((i) => i.subscription_status === "ativa")
    .reduce((s, i) => s + (i.monthly_amount ?? 0), 0);
  const totalCompanies = items.length;
  const activeCount = items.filter((i) => i.subscription_status === "ativa").length;
  // Mesmo critério da tabela: vencimento passado e não cancelada/exempt
  const overdueCount = items.filter((i) => {
    if (["atrasada","suspensa"].includes(i.subscription_status)) return true;
    if (i.subscription_status === "cancelada") return false;
    return !!i.current_period_end &&
      new Date(i.current_period_end) < new Date() &&
      i.subscription_status !== "ativa";
  }).length;
  const totalVehicles = items.reduce((s, i) => s + (i.vehicles_used ?? 0), 0);

  const counts = {
    todas: items.length,
    ativas: items.filter(i => i.subscription_status === "ativa").length,
    trial: items.filter(isTrialActive).length,
    trial_expirado: items.filter(isTrialExpired).length,
    aguardando: items.filter(i => i.subscription_status === "aguardando_pagamento").length,
    atrasadas: items.filter(i => ["atrasada","suspensa"].includes(i.subscription_status)).length,
    canceladas: items.filter(i => i.subscription_status === "cancelada").length,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPI icon={DollarSign} label="MRR" value={fmtBRL(mrr)} accent="text-success" />
          <KPI icon={Building2} label="Clientes" value={`${activeCount}/${totalCompanies}`} hint="ativos / total" />
          <KPI icon={AlertTriangle} label="Atrasados/Suspensos" value={String(overdueCount)} accent={overdueCount ? "text-destructive" : ""} />
          <KPI icon={Truck} label="Veículos na plataforma" value={totalVehicles.toLocaleString("pt-BR")} />
        </div>

        {/* Filtros */}
        <div className="surface-card rounded-xl p-4">
          <Tabs value={tab} onValueChange={setTab} className="mb-4">
            <TabsList className="grid grid-cols-7 w-full sm:w-auto sm:inline-grid">
              <TabsTrigger value="todas">Todas · {counts.todas}</TabsTrigger>
              <TabsTrigger value="ativas">Ativas · {counts.ativas}</TabsTrigger>
              <TabsTrigger value="trial">Trial · {counts.trial}</TabsTrigger>
              <TabsTrigger value="trial_expirado">Trial expirado · {counts.trial_expirado}</TabsTrigger>
              <TabsTrigger value="aguardando">Aguardando · {counts.aguardando}</TabsTrigger>
              <TabsTrigger value="atrasadas">Atrasadas · {counts.atrasadas}</TabsTrigger>
              <TabsTrigger value="canceladas">Canceladas · {counts.canceladas}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar empresa, CNPJ ou plano" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="surface-card rounded-xl p-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-display font-semibold">Nenhuma empresa</h3>
          </div>
        ) : (
          <div className="surface-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Empresa</th>
                    <th className="text-left px-4 py-3">Plano</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Uso</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-left px-4 py-3">Mensalidade</th>
                    <th className="text-left px-4 py-3">Último pagto</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParents.map((i) => {
                    const limit = i.vehicle_limit;
                    const overLimit = limit != null && i.vehicles_used > limit;
                    const overdue = new Date(i.current_period_end) < new Date() && i.subscription_status !== "cancelada";
                    const cm = companyMeta[i.company_id];
                    const isPrimary = !!cm?.is_primary;
                    const groupId = cm?.group_id ?? null;
                    const children = groupId ? (childrenByGroup[groupId] ?? []) : [];
                    const expanded = groupId ? !!expandedGroups[groupId] : false;
                    return (
                      <Fragment key={i.subscription_id}>
                      <tr className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-medium flex items-center gap-2">
                            {isPrimary && groupId && children.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedGroups((p) => ({ ...p, [groupId]: !p[groupId] }))}
                                className="h-5 w-5 grid place-items-center rounded hover:bg-muted text-muted-foreground"
                                title={expanded ? "Recolher grupo" : "Expandir grupo"}
                              >
                                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {i.company_name}
                            {isPrimary && (
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-primary/40 text-primary">
                                <Layers className="h-2.5 w-2.5 mr-1" /> Principal
                                {children.length > 0 && <span className="ml-1">+{children.length}</span>}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{i.cnpj || "Sem CNPJ"} · desde {fmtDate(i.company_created_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">{i.plan_name}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const eff = isTrialExpired(i) ? "trial_expirado" : i.subscription_status;
                            return (
                              <Badge className={`border ${statusTone[eff] ?? ""}`}>
                                {statusLabel[eff] ?? eff}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className={overLimit ? "text-destructive font-medium" : ""}>
                            <Truck className="h-3 w-3 inline mr-1" />
                            {i.vehicles_used}/{limit ?? "∞"}
                          </div>
                          <div className="text-muted-foreground">
                            <Users className="h-3 w-3 inline mr-1" />
                            {i.drivers_count} mot. · {i.members_count} usu.
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-xs ${overdue ? "text-destructive font-medium" : ""}`}>
                          {fmtDate(i.current_period_end)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{fmtBRL(i.monthly_amount)}</td>
                        <td className="px-4 py-3 text-xs">{fmtDate(i.last_payment_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            {isPrimary && cm?.group_id && (
                              <Button size="sm" variant="ghost" onClick={() => setGroupInfo(cm.group_id!)} title="Grupo econômico">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setMembersOf(i)} title="Membros e perfis">
                              <Users className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setPaying(i)} title="Registrar pagamento">
                              <Receipt className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(i)} title="Editar assinatura">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded && children.map((ch) => {
                        const chOverdue = new Date(ch.current_period_end) < new Date() && ch.subscription_status !== "cancelada";
                        const chLimit = ch.vehicle_limit;
                        const chOver = chLimit != null && ch.vehicles_used > chLimit;
                        return (
                          <tr key={ch.subscription_id} className="border-t border-border bg-muted/10 hover:bg-muted/20">
                            <td className="px-4 py-2.5 pl-12">
                              <div className="font-medium text-sm flex items-center gap-2">
                                <span className="text-muted-foreground">↳</span>
                                {ch.company_name}
                                <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">Filha</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">{ch.cnpj || "Sem CNPJ"}</div>
                            </td>
                            <td className="px-4 py-2.5 text-xs">{ch.plan_name}</td>
                            <td className="px-4 py-2.5">
                              {(() => {
                                const eff = isTrialExpired(ch) ? "trial_expirado" : ch.subscription_status;
                                return (
                                  <Badge className={`border ${statusTone[eff] ?? ""}`}>
                                    {statusLabel[eff] ?? eff}
                                  </Badge>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              <div className={chOver ? "text-destructive font-medium" : ""}>
                                <Truck className="h-3 w-3 inline mr-1" />
                                {ch.vehicles_used}/{chLimit ?? "∞"}
                              </div>
                              <div className="text-muted-foreground">
                                <Users className="h-3 w-3 inline mr-1" />
                                {ch.drivers_count} mot. · {ch.members_count} usu.
                              </div>
                            </td>
                            <td className={`px-4 py-2.5 text-xs ${chOverdue ? "text-destructive font-medium" : ""}`}>
                              {fmtDate(ch.current_period_end)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground" title="Faturamento consolidado na principal">—</td>
                            <td className="px-4 py-2.5 text-xs">{fmtDate(ch.last_payment_at)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="inline-flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setMembersOf(ch)} title="Membros e perfis">
                                  <Users className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(ch)} title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <EditSubscriptionDialog sub={editing} plans={plans} onClose={() => setEditing(null)} onSaved={load} />
        <PaymentDialog sub={paying} onClose={() => setPaying(null)} onSaved={load} />
        <CompanyMembersDialog
          companyId={membersOf?.company_id ?? null}
          companyName={membersOf?.company_name ?? ""}
          onClose={() => setMembersOf(null)}
        />
        <GroupInfoDialog groupId={groupInfo} onClose={() => setGroupInfo(null)} />
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint, accent = "" }: any) {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-2xl font-bold font-display ${accent}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function EditSubscriptionDialog({ sub, plans, onClose, onSaved }:
  { sub: Usage | null; plans: Plan[]; onClose: () => void; onSaved: () => void }) {
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [customLimit, setCustomLimit] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sub) {
      setPlanId(sub.plan_id);
      setStatus(sub.subscription_status);
      setPeriodEnd(sub.current_period_end);
      setAmount(String(sub.monthly_amount ?? ""));
      setCustomLimit("");
      setReason("");
    }
  }, [sub]);

  if (!sub) return null;

  const selectedPlan = plans.find((p) => p.id === planId);

  const save = async () => {
    setSaving(true);
    const patch: any = {
      plan_id: planId,
      status,
      current_period_end: periodEnd,
      monthly_amount: amount ? Number(amount) : null,
      custom_vehicle_limit: customLimit ? Number(customLimit) : null,
    };
    if (status === "suspensa") {
      patch.suspended_at = new Date().toISOString();
      patch.suspended_reason = reason || "manual";
    } else {
      patch.suspended_at = null;
      patch.suspended_reason = null;
    }
    if (status === "cancelada") patch.cancelled_at = new Date().toISOString();
    else patch.cancelled_at = null;

    const { error } = await supabase.from("subscriptions").update(patch).eq("id", sub.subscription_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Assinatura atualizada");
    onSaved(); onClose();
  };

  return (
    <Dialog open={!!sub} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{sub.company_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Plano</label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.vehicle_limit ? `(até ${p.vehicle_limit} veíc)` : "(ilimitado)"} · {p.monthly_price ? fmtBRL(p.monthly_price) : "a combinar"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
                <SelectItem value="suspensa">Suspensa (bloqueia uso)</SelectItem>
                <SelectItem value="cancelada">Cancelada (bloqueia uso)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Vence em</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mensalidade (R$)</label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          {selectedPlan?.is_custom && (
            <div>
              <label className="text-xs text-muted-foreground">Limite custom de veículos (Enterprise)</label>
              <Input type="number" placeholder="Deixe vazio = ilimitado" value={customLimit} onChange={(e) => setCustomLimit(e.target.value)} />
            </div>
          )}
          {status === "suspensa" && (
            <div>
              <label className="text-xs text-muted-foreground">Motivo da suspensão</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: pagamento em atraso há 30 dias" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ sub, onClose, onSaved }:
  { sub: Usage | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("pix");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (sub) {
      setAmount(String(sub.monthly_amount ?? ""));
      setPaidAt(new Date().toISOString().slice(0, 10));
      setMethod("pix");
      setReference("");
      setNotes("");
      setExtendDays("30");
    }
  }, [sub]);

  if (!sub) return null;

  const save = async () => {
    setSaving(true);
    const { error: e1 } = await supabase.from("subscription_payments").insert({
      subscription_id: sub.subscription_id,
      company_id: sub.company_id,
      amount: Number(amount),
      paid_at: paidAt,
      method: method as any,
      reference: reference || null,
      notes: notes || null,
      recorded_by: user?.id,
    });
    if (e1) { setSaving(false); return toast.error(e1.message); }

    // Renova vencimento e ativa
    const days = Number(extendDays) || 30;
    const base = new Date(sub.current_period_end);
    if (base < new Date()) base.setTime(new Date().getTime());
    base.setDate(base.getDate() + days);
    const newEnd = base.toISOString().slice(0, 10);

    const { error: e2 } = await supabase.from("subscriptions").update({
      status: "ativa",
      current_period_start: paidAt,
      current_period_end: newEnd,
      suspended_at: null,
      suspended_reason: null,
    }).eq("id", sub.subscription_id);
    setSaving(false);
    if (e2) return toast.error(e2.message);
    toast.success("Pagamento registrado e assinatura renovada");
    onSaved(); onClose();
  };

  return (
    <Dialog open={!!sub} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento — {sub.company_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Valor (R$)</label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Método</label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Estender (dias)</label>
              <Input type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Referência (NF, transação)</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Observações</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Registrar e renovar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}