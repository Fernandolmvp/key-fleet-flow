import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Search, Sparkles, ShieldCheck } from "lucide-react";
import VehicleDialog from "@/components/dashboard/VehicleDialog";
import { toast } from "sonner";
import { normalizePlate, normChassis, normRenavam } from "@/lib/plate";

type Policy = {
  id: string;
  policy_number: string;
  insurer_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  ai_extracted: any;
};
type AiVehicle = { plate: string; brand?: string | null; model?: string | null; year?: string | null; chassis?: string | null; renavam?: string | null };
type OrphanRow = { plate: string; ai: AiVehicle; policy: Policy };

const normId = (s?: string | null) =>
  String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const chassisMatch = (a?: string|null, b?: string|null) => {
  const x = normChassis(a), y = normChassis(b);
  return !!x && !!y && (x === y || x.slice(-8) === y.slice(-8));
};

export default function InsuranceOrphans() {
  const { currentCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [registeredPlates, setRegisteredPlates] = useState<Set<string>>(new Set());
  const [vehiclesData, setVehiclesData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [batchQueue, setBatchQueue] = useState<OrphanRow[]>([]);

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const [p, v] = await Promise.all([
      supabase.from("insurance_policies").select("id,policy_number,insurer_name,start_date,end_date,status,ai_extracted")
        .eq("company_id", currentCompanyId).eq("status", "ativa"),
      supabase.from("vehicles").select("plate,chassis,renavam").eq("company_id", currentCompanyId),
    ]);
    setPolicies((p.data as any[]) || []);
    setVehiclesData((v.data as any[]) || []);
    setRegisteredPlates(new Set(((v.data as any[]) || []).map((r) => normalizePlate(r.plate)).filter(Boolean)));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  const orphans = useMemo<OrphanRow[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
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
        if (registeredPlates.has(key)) continue;
        // descarta se chassi/renavam já existe em algum veículo cadastrado
        const matchedByVin = vehiclesData.some(
          (v) => chassisMatch(v.chassis, a.chassis) ||
                 (normRenavam(v.renavam) && normRenavam(v.renavam) === normRenavam(a.renavam)),
        );
        if (matchedByVin) continue;
        rows.push({ plate: (a.plate || key).toUpperCase(), ai: a, policy: p });
      }
    }
    return rows.sort((x, y) => x.plate.localeCompare(y.plate));
  }, [policies, registeredPlates, vehiclesData]);

  const filtered = useMemo(() => {
    const q = normId(search);
    if (!q) return orphans;
    return orphans.filter((r) => normId(r.plate).includes(q) || (r.ai.chassis && normId(r.ai.chassis).includes(q)));
  }, [orphans, search]);

  // dedupe por placa para a lista de seleção (mas mantém todas as linhas exibidas)
  const uniquePlates = useMemo(() => Array.from(new Set(filtered.map((r) => normId(r.plate)))), [filtered]);
  const allChecked = uniquePlates.length > 0 && uniquePlates.every((k) => selected.has(k));

  function toggle(plateKey: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(plateKey)) next.delete(plateKey); else next.add(plateKey);
      return next;
    });
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(uniquePlates));
  }

  function buildPrefill(ai: AiVehicle) {
    return {
      plate: (ai.plate || "").toUpperCase(),
      brand: ai.brand || "",
      model: ai.model || "",
      year_manufacture: ai.year || "",
      year_model: ai.year || "",
      chassis: ai.chassis || "",
    };
  }

  function startSingle(row: OrphanRow) {
    setBatchQueue([]);
    setPrefill(buildPrefill(row.ai));
    setDialogOpen(true);
  }

  function startBatch() {
    const map = new Map<string, OrphanRow>();
    for (const r of filtered) {
      const k = normId(r.plate);
      if (selected.has(k) && !map.has(k)) map.set(k, r);
    }
    const queue = Array.from(map.values());
    if (!queue.length) {
      toast.error("Selecione ao menos uma placa.");
      return;
    }
    setBatchQueue(queue);
    setPrefill(buildPrefill(queue[0].ai));
    setDialogOpen(true);
  }

  async function onSavedOne() {
    setSelected((s) => {
      const next = new Set(s);
      if (prefill?.plate) next.delete(normId(prefill.plate));
      return next;
    });
    if (batchQueue.length > 1) {
      const rest = batchQueue.slice(1);
      setBatchQueue(rest);
      setPrefill(buildPrefill(rest[0].ai));
      // mantém o dialog aberto
      toast.success(`Veículo cadastrado. ${rest.length} restante(s).`);
      await load();
      return;
    }
    setBatchQueue([]);
    setPrefill(null);
    setDialogOpen(false);
    toast.success("Veículos cadastrados e vinculados às apólices.");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <RouterLink to="/app/insurance"><ArrowLeft className="h-4 w-4" /> Seguros</RouterLink>
        </Button>
        <div className="h-10 w-10 rounded-lg bg-sky-500/15 grid place-items-center text-sky-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Placas órfãs</h1>
          <p className="text-sm text-muted-foreground">
            Placas presentes em apólices vigentes mas ainda não cadastradas como veículos da frota.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto bg-sky-500/15 text-sky-400 border-sky-500/30">
          {orphans.length} placa(s)
        </Badge>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Filtrar por placa ou chassi..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={startBatch} disabled={selected.size === 0}>
            <Plus className="h-4 w-4" /> Cadastrar selecionados ({selected.size})
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center flex flex-col items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            Nenhuma placa órfã encontrada. Toda a sua frota coberta está cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 text-left w-8">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-2 text-left">Placa</th>
                  <th className="p-2 text-left">Modelo (apólice)</th>
                  <th className="p-2 text-left">Apólice</th>
                  <th className="p-2 text-left">Seguradora</th>
                  <th className="p-2 text-left">Vigência</th>
                  <th className="p-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const key = normId(r.plate);
                  const model = [r.ai.brand, r.ai.model].filter(Boolean).join(" ") + (r.ai.year ? ` ${r.ai.year}` : "");
                  return (
                    <tr key={`${key}-${r.policy.id}-${i}`} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="p-2"><Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} /></td>
                      <td className="p-2 font-mono font-bold text-sky-400">{r.plate}</td>
                      <td className="p-2 text-muted-foreground">{model || "—"}</td>
                      <td className="p-2 font-mono text-xs">#{r.policy.policy_number}</td>
                      <td className="p-2">{r.policy.insurer_name}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {r.policy.start_date || "—"} → {r.policy.end_date || "—"}
                      </td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => startSingle(r)}>
                          <Plus className="h-3.5 w-3.5" /> Cadastrar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <VehicleDialog
        open={dialogOpen}
        onOpenChange={(o: boolean) => {
          setDialogOpen(o);
          if (!o) { setPrefill(null); setBatchQueue([]); }
        }}
        vehicle={null}
        prefill={prefill}
        onSaved={onSavedOne}
      />
    </div>
  );
}