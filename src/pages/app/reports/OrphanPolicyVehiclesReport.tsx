import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, Search, Sparkles, Loader2 } from "lucide-react";
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
type AiVehicle = {
  plate?: string;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  chassis?: string | null;
  renavam?: string | null;
  fipe?: string | null;
  insured_amount?: string | number | null;
  premium?: string | number | null;
  category?: string | null;
  use?: string | null;
  city?: string | null;
  state?: string | null;
  owner?: string | null;
  owner_name?: string | null;
  proprietario?: string | null;
  segurado?: string | null;
  insured_name?: string | null;
};
type Row = {
  plate: string;
  ai: AiVehicle;
  policy: Policy;
  owner: string | null;
};

const chassisMatch = (a?: string | null, b?: string | null) => {
  const x = normChassis(a),
    y = normChassis(b);
  return !!x && !!y && (x === y || x.slice(-8) === y.slice(-8));
};

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtMoney(v: any): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!isFinite(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OrphanPolicyVehiclesReport() {
  const { currentCompanyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [vehiclesData, setVehiclesData] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [insurerFilter, setInsurerFilter] = useState<string>("all");
  const [includeExpired, setIncludeExpired] = useState(false);

  useEffect(() => {
    if (!currentCompanyId) return;
    setLoading(true);
    (async () => {
      const [p, v] = await Promise.all([
        supabase
          .from("insurance_policies")
          .select("id,policy_number,insurer_name,start_date,end_date,status,ai_extracted")
          .eq("company_id", currentCompanyId),
        supabase.from("vehicles").select("plate,chassis,renavam").eq("company_id", currentCompanyId),
      ]);
      if (p.error || v.error) toast.error("Falha ao carregar dados");
      setPolicies((p.data as any[]) || []);
      setVehiclesData((v.data as any[]) || []);
      setLoading(false);
    })();
  }, [currentCompanyId]);

  const registeredPlates = useMemo(
    () => new Set(vehiclesData.map((r) => normalizePlate(r.plate)).filter(Boolean)),
    [vehiclesData],
  );

  const orphans = useMemo<Row[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows: Row[] = [];
    for (const p of policies) {
      if (!includeExpired && p.end_date && p.end_date < today) continue;
      const ex: any = p.ai_extracted || {};
      const list: AiVehicle[] = Array.isArray(ex.vehicles) && ex.vehicles.length
        ? ex.vehicles
        : Array.isArray(ex.plates)
        ? ex.plates.map((pl: string) => ({ plate: pl } as AiVehicle))
        : [];
      for (const a of list) {
        const key = normalizePlate(a.plate);
        if (!key) continue;
        if (registeredPlates.has(key)) continue;
        const matchedByVin = vehiclesData.some(
          (v) =>
            chassisMatch(v.chassis, a.chassis) ||
            (normRenavam(v.renavam) && normRenavam(v.renavam) === normRenavam(a.renavam)),
        );
        if (matchedByVin) continue;
        const owner =
          a.owner ?? a.owner_name ?? a.proprietario ?? a.segurado ?? a.insured_name ??
          ex.owner ?? ex.owner_name ?? ex.proprietario ?? ex.segurado ?? ex.insured_name ?? null;
        rows.push({ plate: (a.plate || key).toUpperCase(), ai: a, policy: p, owner });
      }
    }
    return rows.sort((x, y) => x.plate.localeCompare(y.plate));
  }, [policies, registeredPlates, vehiclesData, includeExpired]);

  const insurers = useMemo(
    () => Array.from(new Set(orphans.map((r) => r.policy.insurer_name).filter(Boolean))).sort(),
    [orphans],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase();
    return orphans.filter((r) => {
      if (insurerFilter !== "all" && r.policy.insurer_name !== insurerFilter) return false;
      if (!term) return true;
      return (
        r.plate.toUpperCase().includes(term) ||
        (r.ai.chassis || "").toUpperCase().includes(term) ||
        (r.ai.renavam || "").includes(term) ||
        (r.policy.policy_number || "").toUpperCase().includes(term) ||
        (r.ai.brand || "").toUpperCase().includes(term) ||
        (r.ai.model || "").toUpperCase().includes(term) ||
        (r.owner || "").toUpperCase().includes(term)
      );
    });
  }, [orphans, q, insurerFilter]);

  const uniquePlates = useMemo(() => new Set(filtered.map((r) => normalizePlate(r.plate))).size, [filtered]);

  function exportCsv() {
    const header = [
      "Placa",
      "Marca",
      "Modelo",
      "Ano",
      "Chassi",
      "RENAVAM",
      "Proprietário",
      "Categoria",
      "Uso",
      "Cidade",
      "UF",
      "Valor Segurado",
      "Prêmio",
      "Apólice",
      "Seguradora",
      "Início Vigência",
      "Fim Vigência",
      "Status Apólice",
    ];
    const lines = [header.join(";")];
    filtered.forEach((r) => {
      const a = r.ai;
      lines.push(
        [
          r.plate,
          a.brand ?? "",
          a.model ?? "",
          a.year ?? "",
          a.chassis ?? "",
          a.renavam ?? "",
          r.owner ?? "",
          a.category ?? "",
          a.use ?? "",
          a.city ?? "",
          a.state ?? "",
          fmtMoney(a.insured_amount),
          fmtMoney(a.premium),
          r.policy.policy_number,
          r.policy.insurer_name,
          r.policy.start_date ?? "",
          r.policy.end_date ?? "",
          r.policy.status,
        ]
          .map(csvEscape)
          .join(";"),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veiculos-em-apolice-sem-cadastro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          to="/app/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Relatórios
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Veículos em apólice sem cadastro
        </h1>
        <p className="text-sm text-muted-foreground">
          Placas extraídas das apólices de seguro que ainda não constam como veículos cadastrados na frota.
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, chassi, RENAVAM, apólice, marca/modelo..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={insurerFilter}
            onChange={(e) => setInsurerFilter(e.target.value)}
          >
            <option value="all">Todas seguradoras</option>
            {insurers.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
            />
            Incluir apólices vencidas
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{filtered.length} linha(s)</span>
          <span>•</span>
          <span>{uniquePlates} placa(s) únicas</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum veículo de apólice sem cadastro encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase font-mono text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2.5">Placa</th>
                  <th className="text-left px-3 py-2.5">Marca / Modelo</th>
                  <th className="text-left px-3 py-2.5">Ano</th>
                  <th className="text-left px-3 py-2.5">Chassi</th>
                  <th className="text-left px-3 py-2.5">RENAVAM</th>
                  <th className="text-left px-3 py-2.5">Proprietário</th>
                  <th className="text-left px-3 py-2.5">Cidade/UF</th>
                  <th className="text-right px-3 py-2.5">Valor Segurado</th>
                  <th className="text-right px-3 py-2.5">Prêmio</th>
                  <th className="text-left px-3 py-2.5">Apólice</th>
                  <th className="text-left px-3 py-2.5">Seguradora</th>
                  <th className="text-left px-3 py-2.5">Vigência</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const a = r.ai;
                  const today = new Date().toISOString().slice(0, 10);
                  const expired = !!r.policy.end_date && r.policy.end_date < today;
                  return (
                    <tr key={`${r.plate}-${r.policy.id}-${i}`} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-mono font-bold text-sky-400">{r.plate}</td>
                      <td className="px-3 py-2.5">
                        {[a.brand, a.model].filter(Boolean).join(" ") || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{a.year || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{a.chassis || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{a.renavam || "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{r.owner || "—"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {[a.city, a.state].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {fmtMoney(a.insured_amount) || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {fmtMoney(a.premium) || "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">#{r.policy.policy_number}</td>
                      <td className="px-3 py-2.5 text-xs">{r.policy.insurer_name}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">
                            {r.policy.start_date || "—"} → {r.policy.end_date || "—"}
                          </span>
                          {expired && (
                            <Badge variant="outline" className="mt-1 w-fit border-amber-500/40 text-amber-400">
                              vencida
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}