import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Search, Sparkles, Link2, Plus, ShieldCheck, AlertTriangle, Ban, Trash2, Calendar, FileText, History,
} from "lucide-react";
import VehicleDialog from "@/components/dashboard/VehicleDialog";
import { toast } from "sonner";
import { normalizePlate, normChassis, normRenavam } from "@/lib/plate";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type Policy = {
  id: string; policy_number: string; insurer_name: string;
  start_date: string | null; end_date: string | null;
  status: string; ai_extracted: any; file_url: string | null;
};
type AiVehicle = {
  plate: string; brand?: string|null; model?: string|null; year?: string|null;
  chassis?: string|null; renavam?: string|null;
};
type Vehicle = {
  id: string; plate: string; brand: string; model: string;
  chassis: string|null; renavam: string|null; status: string;
};
type ManualMatch = {
  id: string; vehicle_id: string; policy_id: string;
  ai_plate: string; normalized_plate: string;
  matched_by: string|null; matched_at: string;
  reason: string; notes: string|null;
  can_be_revoked: boolean; revoked_at: string|null;
};
type External = {
  id: string; policy_id: string; ai_plate: string;
  normalized_plate: string; reason: string|null; marked_at: string;
};

type OrphanRow = { plate: string; ai: AiVehicle; policy: Policy };

const norm = (s?: string|null) => String(s||"").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Tolera confusões clássicas de OCR (O↔0, I↔1, S↔5, B↔8, Z↔2, G↔6). */
const ocrKey = (s?: string|null) =>
  normalizePlate(s).replace(/O/g, "0").replace(/I/g, "1").replace(/S/g, "5")
    .replace(/B/g, "8").replace(/Z/g, "2").replace(/G/g, "6");
const chassisMatch = (a?: string|null, b?: string|null) => {
  const x = normChassis(a), y = normChassis(b);
  return !!x && !!y && (x === y || x.slice(-8) === y.slice(-8));
};

/** Score de similaridade simples entre placa órfã e veículo da frota. */
function similarity(plate: string, ai: AiVehicle, v: Vehicle): number {
  let s = 0;
  const np = normalizePlate(plate), vp = normalizePlate(v.plate);
  if (np && vp) {
    if (np === vp) s += 100;
    else if (ocrKey(np) && ocrKey(np) === ocrKey(vp)) s += 90;
    else if (np.slice(0,3) === vp.slice(0,3)) s += 30;
    else if (np.slice(-4) === vp.slice(-4)) s += 20;
  }
  if (chassisMatch(ai.chassis, v.chassis)) s += 80;
  if (ai.renavam && normRenavam(ai.renavam) && normRenavam(ai.renavam) === normRenavam(v.renavam)) s += 80;
  const am = (ai.model||"").toLowerCase(), vm = (v.model||"").toLowerCase();
  if (am && vm && (am.includes(vm) || vm.includes(am))) s += 15;
  const ab = (ai.brand||"").toLowerCase(), vb = (v.brand||"").toLowerCase();
  if (ab && vb && ab === vb) s += 10;
  return s;
}

export default function ReviewMatches() {
  const { currentCompanyId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [manuals, setManuals] = useState<ManualMatch[]>([]);
  const [externals, setExternals] = useState<External[]>([]);
  const [linkedVehicleIds, setLinkedVehicleIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [active, setActive] = useState<OrphanRow | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalReason, setExternalReason] = useState("");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [vehiclePrefill, setVehiclePrefill] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const [p, v, m, e, l] = await Promise.all([
      supabase.from("insurance_policies")
        .select("id,policy_number,insurer_name,start_date,end_date,status,ai_extracted,file_url")
        .eq("company_id", currentCompanyId).eq("status","ativa"),
      supabase.from("vehicles")
        .select("id,plate,brand,model,chassis,renavam,status")
        .eq("company_id", currentCompanyId).eq("status","ativo").order("plate"),
      supabase.from("vehicle_policy_manual_matches" as any)
        .select("*").eq("company_id", currentCompanyId).is("revoked_at", null),
      supabase.from("policy_external_plates" as any)
        .select("*").eq("company_id", currentCompanyId),
      supabase.from("insurance_policy_vehicles")
        .select("vehicle_id,policy_id,removed_at")
        .eq("company_id", currentCompanyId).is("removed_at", null),
    ]);
    setPolicies((p.data as any[])||[]);
    setVehicles((v.data as any[])||[]);
    setManuals(((m.data as any[])||[]) as ManualMatch[]);
    setExternals(((e.data as any[])||[]) as External[]);
    const setIds = new Set<string>();
    ((l.data as any[])||[]).forEach((r:any) => setIds.add(r.vehicle_id));
    ((m.data as any[])||[]).forEach((r:any) => setIds.add(r.vehicle_id));
    setLinkedVehicleIds(setIds);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  const orphans = useMemo<OrphanRow[]>(() => {
    const today = new Date().toISOString().slice(0,10);
    const registered = new Set(vehicles.map(v => normalizePlate(v.plate)).filter(Boolean));
    const externalKeys = new Set(externals.map(e => `${e.policy_id}|${e.normalized_plate}`));
    const manualKeys = new Set(manuals.map(m => `${m.policy_id}|${m.normalized_plate}`));
    const rows: OrphanRow[] = [];
    for (const p of policies) {
      if (p.end_date && p.end_date < today) continue;
      const ex: any = p.ai_extracted || {};
      const list: AiVehicle[] = Array.isArray(ex.vehicles) && ex.vehicles.length
        ? ex.vehicles
        : (Array.isArray(ex.plates) ? ex.plates.map((pl: string) => ({ plate: pl } as AiVehicle)) : []);
      for (const a of list) {
        const key = normalizePlate(a.plate);
        if (!key) continue;
        if (registered.has(key)) continue;
        const matchedByVin = vehicles.some(v =>
          chassisMatch(v.chassis, a.chassis) ||
          (a.renavam && normRenavam(a.renavam) && normRenavam(v.renavam) === normRenavam(a.renavam)),
        );
        if (matchedByVin) continue;
        if (externalKeys.has(`${p.id}|${key}`)) continue;
        if (manualKeys.has(`${p.id}|${key}`)) continue;
        rows.push({ plate: (a.plate||key).toUpperCase(), ai: a, policy: p });
      }
    }
    return rows.sort((x,y) => x.plate.localeCompare(y.plate));
  }, [policies, vehicles, externals, manuals]);

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return orphans;
    return orphans.filter(r => norm(r.plate).includes(q) || (r.ai.chassis && norm(r.ai.chassis).includes(q)));
  }, [orphans, search]);

  // Sempre mantém um orphan ativo (esquerda). Se removerem, pula pro próximo.
  useEffect(() => {
    if (!active && filtered.length) setActive(filtered[0]);
    if (active) {
      const stillThere = filtered.find(r => r.policy.id === active.policy.id && norm(r.plate) === norm(active.plate));
      if (!stillThere) setActive(filtered[0] || null);
    }
  }, [filtered, active]);

  // Veículos sem nenhum vínculo (candidatos)
  const candidates = useMemo(() => {
    if (!active) return [];
    const free = vehicles.filter(v => !linkedVehicleIds.has(v.id));
    return free
      .map(v => ({ v, score: similarity(active.plate, active.ai, v) }))
      .sort((a,b) => b.score - a.score);
  }, [vehicles, linkedVehicleIds, active]);

  function openConfirm() {
    if (!active || !selectedVehicle) {
      toast.error("Selecione um veículo da direita.");
      return;
    }
    setConfirmNotes("");
    setConfirmOpen(true);
  }

  async function doManualMatch() {
    if (!active || !selectedVehicle || !currentCompanyId) return;
    setBusy(true);
    try {
      const np = normalizePlate(active.plate);
      const v = vehicles.find(x => x.id === selectedVehicle);
      // detectar reason automático
      let reason: string = "manual_review";
      if (v) {
        if (chassisMatch(v.chassis, active.ai.chassis)) reason = "chassi_match";
        else if (active.ai.renavam && normRenavam(v.renavam) === normRenavam(active.ai.renavam)) reason = "renavam_match";
        else if (np && normalizePlate(v.plate) === np) reason = "plate_mercosul_conversion";
      }
      const ins = await (supabase.from("vehicle_policy_manual_matches" as any) as any).insert({
        company_id: currentCompanyId,
        vehicle_id: selectedVehicle,
        policy_id: active.policy.id,
        ai_plate: active.plate,
        normalized_plate: np || norm(active.plate),
        matched_by: user?.id || null,
        reason,
        notes: confirmNotes || null,
      }).select().single();
      if (ins.error) throw ins.error;
      await supabase.from("audit_logs").insert({
        company_id: currentCompanyId,
        table_name: "vehicle_policy_manual_matches",
        record_id: (ins.data as any).id,
        action: "create_manual_match",
        user_id: user?.id || null,
        changes: { vehicle_id: selectedVehicle, policy_id: active.policy.id, ai_plate: active.plate, reason } as any,
      });
      toast.success("Veículo vinculado à apólice.");
      setConfirmOpen(false);
      setSelectedVehicle(null);
      setActive(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao vincular.");
    } finally {
      setBusy(false);
    }
  }

  async function doMarkExternal() {
    if (!active || !currentCompanyId) return;
    setBusy(true);
    try {
      const np = normalizePlate(active.plate);
      const ins = await (supabase.from("policy_external_plates" as any) as any).insert({
        company_id: currentCompanyId,
        policy_id: active.policy.id,
        ai_plate: active.plate,
        normalized_plate: np || norm(active.plate),
        marked_by: user?.id || null,
        reason: externalReason || null,
      }).select().single();
      if (ins.error) throw ins.error;
      await supabase.from("audit_logs").insert({
        company_id: currentCompanyId,
        table_name: "policy_external_plates",
        record_id: (ins.data as any).id,
        action: "mark_external_plate",
        user_id: user?.id || null,
        changes: { policy_id: active.policy.id, ai_plate: active.plate, reason: externalReason } as any,
      });
      toast.success("Placa marcada como veículo externo.");
      setExternalOpen(false);
      setExternalReason("");
      setActive(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao marcar.");
    } finally {
      setBusy(false);
    }
  }

  function openRegister() {
    if (!active) return;
    setVehiclePrefill({
      plate: active.plate,
      brand: active.ai.brand || "",
      model: active.ai.model || "",
      year_manufacture: active.ai.year || "",
      year_model: active.ai.year || "",
      chassis: active.ai.chassis || "",
      renavam: active.ai.renavam || "",
    });
    setVehicleDialogOpen(true);
  }

  async function onVehicleSaved() {
    setVehicleDialogOpen(false);
    setVehiclePrefill(null);
    // Após cadastrar, o sistema reconhece automaticamente pela placa normalizada.
    // Se não bater (placa diferente), criamos um manual_match contra o veículo recém-criado.
    if (active && currentCompanyId) {
      const { data: vRow } = await supabase
        .from("vehicles")
        .select("id,plate,chassis,renavam")
        .eq("company_id", currentCompanyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vRow) {
        const np = normalizePlate(active.plate);
        const sameByPlate = normalizePlate((vRow as any).plate) === np;
        const sameByVin = chassisMatch((vRow as any).chassis, active.ai.chassis) ||
          (active.ai.renavam && normRenavam((vRow as any).renavam) === normRenavam(active.ai.renavam));
        if (!sameByPlate && !sameByVin) {
          await (supabase.from("vehicle_policy_manual_matches" as any) as any).insert({
            company_id: currentCompanyId,
            vehicle_id: (vRow as any).id,
            policy_id: active.policy.id,
            ai_plate: active.plate,
            normalized_plate: np || norm(active.plate),
            matched_by: user?.id || null,
            reason: "manual_review",
            notes: "Cadastro novo a partir da revisão",
          });
        }
      }
    }
    setActive(null);
    await load();
    toast.success("Veículo cadastrado e vinculado.");
  }

  // Resumo
  const stats = useMemo(() => ({
    pending: orphans.length,
    manual: manuals.length,
    external: externals.length,
  }), [orphans, manuals, externals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <RouterLink to="/app/insurance"><ArrowLeft className="h-4 w-4" /> Seguros</RouterLink>
        </Button>
        <div className="h-10 w-10 rounded-lg bg-amber-500/15 grid place-items-center text-amber-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Revisar vinculações pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Placas de apólices vigentes que não foram cruzadas automaticamente com a frota — revise manualmente.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
            {stats.pending} pendente(s)
          </Badge>
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            {stats.manual} vinculadas manualmente
          </Badge>
          <Badge variant="outline" className="bg-muted">
            {stats.external} externas
          </Badge>
        </div>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar por placa ou chassi…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto" />
          <div className="font-display font-bold">Tudo revisado!</div>
          <div className="text-sm text-muted-foreground">
            Nenhuma placa de apólice está pendente de vinculação.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ESQUERDA — lista de pendências */}
          <Card className="lg:col-span-4 p-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1">
              {filtered.map((r, i) => {
                const isActive = active && active.policy.id === r.policy.id && norm(active.plate) === norm(r.plate);
                return (
                  <button key={`${r.policy.id}-${norm(r.plate)}-${i}`}
                    type="button"
                    onClick={() => { setActive(r); setSelectedVehicle(null); }}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      isActive
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-border hover:bg-muted/30"
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-amber-400">{r.plate}</span>
                      <Badge variant="outline" className="text-[10px]">#{r.policy.policy_number}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {[r.ai.brand, r.ai.model].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.policy.insurer_name}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* CENTRO — detalhe da apólice */}
          <Card className="lg:col-span-4 p-4 space-y-3">
            {active && (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <div className="font-display font-bold">Placa órfã da apólice</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Placa</div>
                  <div className="font-mono font-bold text-2xl text-amber-400">{active.plate}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Modelo (apólice)</div>
                    <div className="font-medium">
                      {[active.ai.brand, active.ai.model].filter(Boolean).join(" ") || "—"}
                      {active.ai.year ? ` ${active.ai.year}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Chassi</div>
                    <div className="font-mono">{active.ai.chassis || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Renavam</div>
                    <div className="font-mono">{active.ai.renavam || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Apólice</div>
                    <div className="font-mono">#{active.policy.policy_number}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Seguradora</div>
                    <div className="font-medium">{active.policy.insurer_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Vigência</div>
                    <div className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {active.policy.start_date || "—"} → {active.policy.end_date || "—"}
                    </div>
                  </div>
                </div>
                {active.policy.file_url && (
                  <a href={active.policy.file_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">
                    <FileText className="h-3 w-3" /> Abrir PDF da apólice
                  </a>
                )}

                <div className="pt-3 border-t border-border space-y-2">
                  <Button className="w-full" onClick={openConfirm} disabled={!selectedVehicle || busy}>
                    <Link2 className="h-4 w-4" /> Vincular este veículo →
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setExternalOpen(true)} disabled={busy}>
                    <Ban className="h-4 w-4" /> Marcar como NÃO pertence à frota
                  </Button>
                  <Button variant="outline" className="w-full" onClick={openRegister} disabled={busy}>
                    <Plus className="h-4 w-4" /> Cadastrar como veículo novo
                  </Button>
                </div>
              </>
            )}
          </Card>

          {/* DIREITA — candidatos */}
          <Card className="lg:col-span-4 p-3 max-h-[70vh] overflow-y-auto">
            <div className="text-xs uppercase text-muted-foreground font-medium px-1 pb-2">
              Veículos da frota não vinculados ({candidates.length})
            </div>
            {candidates.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Nenhum veículo livre. Use “Cadastrar novo” para incluir.
              </div>
            ) : (
              <div className="space-y-1">
                {candidates.map(({ v, score }) => {
                  const isSel = selectedVehicle === v.id;
                  return (
                    <button
                      key={v.id} type="button"
                      onClick={() => setSelectedVehicle(isSel ? null : v.id)}
                      className={`w-full text-left p-2.5 rounded-md border transition-colors flex items-start gap-2 ${
                        isSel
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-border hover:bg-muted/30"
                      }`}>
                      <div className={`mt-0.5 h-4 w-4 rounded border ${isSel ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold">{v.plate}</span>
                          {score >= 60 && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              compatível
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                        </div>
                        {v.chassis && (
                          <div className="text-[10px] font-mono text-muted-foreground truncate">
                            Chassi: {v.chassis}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Histórico de manuais */}
      {manuals.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <div className="font-display font-bold">Histórico de vinculações manuais</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 text-left">Placa (apólice)</th>
                  <th className="p-2 text-left">Veículo</th>
                  <th className="p-2 text-left">Apólice</th>
                  <th className="p-2 text-left">Motivo</th>
                  <th className="p-2 text-left">Quando</th>
                  <th className="p-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {manuals.map((m) => {
                  const v = vehicles.find(x => x.id === m.vehicle_id);
                  const p = policies.find(x => x.id === m.policy_id);
                  return (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="p-2 font-mono">{m.ai_plate}</td>
                      <td className="p-2 font-mono">{v?.plate || "—"}</td>
                      <td className="p-2 font-mono text-xs">#{p?.policy_number || "—"}</td>
                      <td className="p-2 text-xs">{m.reason}</td>
                      <td className="p-2 text-xs text-muted-foreground">{new Date(m.matched_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2 text-right">
                        {m.can_be_revoked && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            if (!confirm("Revogar esta vinculação manual?")) return;
                            const r = await (supabase.from("vehicle_policy_manual_matches" as any) as any)
                              .update({ revoked_at: new Date().toISOString(), revoked_by: user?.id || null })
                              .eq("id", m.id);
                            if (r.error) { toast.error(r.error.message); return; }
                            await supabase.from("audit_logs").insert({
                              company_id: currentCompanyId!,
                              table_name: "vehicle_policy_manual_matches",
                              record_id: m.id,
                              action: "revoke_manual_match",
                              user_id: user?.id || null,
                              changes: {} as any,
                            });
                            toast.success("Vinculação revogada.");
                            await load();
                          }}>
                            <Trash2 className="h-3.5 w-3.5" /> Revogar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmação manual match */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar vinculação manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Confirma que o veículo <span className="font-mono font-bold">{vehicles.find(v => v.id === selectedVehicle)?.plate}</span>
              {" "}é o mesmo coberto pela apólice <span className="font-mono font-bold">#{active?.policy.policy_number}</span>
              {" "}(placa <span className="font-mono font-bold">{active?.plate}</span>)?
            </p>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Ex.: placa antiga vs Mercosul, veículo trocou de placa, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={doManualMatch} disabled={busy}>
              <Link2 className="h-4 w-4" /> Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marcar como externo */}
      <Dialog open={externalOpen} onOpenChange={setExternalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar placa como NÃO pertence à frota</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              A placa <span className="font-mono font-bold">{active?.plate}</span> deixa de aparecer nos alertas e na lista de pendências.
              Use para veículos de terceiros, parceiros ou que foram removidos da frota.
            </p>
            <div>
              <Label>Motivo</Label>
              <Textarea value={externalReason} onChange={(e) => setExternalReason(e.target.value)}
                placeholder="Ex.: veículo do parceiro X, não pertence mais à frota, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExternalOpen(false)} disabled={busy}>Cancelar</Button>
            <Button variant="destructive" onClick={doMarkExternal} disabled={busy}>
              <Ban className="h-4 w-4" /> Marcar como externa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={(o: boolean) => { setVehicleDialogOpen(o); if (!o) setVehiclePrefill(null); }}
        vehicle={null}
        prefill={vehiclePrefill}
        onSaved={onVehicleSaved}
      />
    </div>
  );
}