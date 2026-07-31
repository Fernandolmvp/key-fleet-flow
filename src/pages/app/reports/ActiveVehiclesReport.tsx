import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Printer, Search, CarFront, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Vehicle = Record<string, any>;

type LinkRow = {
  vehicle_id: string;
  policy: {
    policy_number: string | null;
    insurer_name: string | null;
    insurer_phone: string | null;
    insurer_email: string | null;
    start_date: string | null;
    end_date: string | null;
    total_value: number | null;
    deductible: number | null;
    coverage_type: string | null;
    coverage_summary: string | null;
    status: string | null;
    broker: { name: string | null; phone?: string | null; email?: string | null } | null;
  } | null;
};

type Row = Vehicle & { link?: LinkRow | null };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : "";
}
function fmtMoney(v: any) {
  return v == null || v === "" ? "" : brl.format(Number(v));
}

/** Colunas do relatório: rótulo + extrator de valor (string pronta para exibir/exportar). */
const COLUMNS: { label: string; get: (r: Row) => string }[] = [
  { label: "Placa", get: (r) => r.plate ?? "" },
  { label: "Chassi", get: (r) => r.chassis ?? "" },
  { label: "RENAVAM", get: (r) => r.renavam ?? "" },
  { label: "Marca", get: (r) => r.brand ?? "" },
  { label: "Modelo", get: (r) => r.model ?? "" },
  { label: "Ano fab.", get: (r) => (r.year_manufacture ? String(r.year_manufacture) : "") },
  { label: "Ano modelo", get: (r) => (r.year_model ? String(r.year_model) : "") },
  { label: "Cor", get: (r) => r.color ?? "" },
  { label: "Tipo", get: (r) => r.vehicle_type ?? "" },
  { label: "Combustível", get: (r) => r.fuel_type ?? "" },
  { label: "Tanque (L)", get: (r) => (r.tank_capacity != null ? String(r.tank_capacity) : "") },
  { label: "KM atual", get: (r) => (r.current_km != null ? String(r.current_km) : "") },
  { label: "Consumo esperado (km/l)", get: (r) => (r.expected_consumption_kml != null ? String(r.expected_consumption_kml) : "") },
  { label: "Rastreador", get: (r) => (r.has_tracker ? "Sim" : "Não") },
  { label: "Responsável", get: (r) => r.responsible ?? "" },
  { label: "Proprietário", get: (r) => r.owner_name ?? "" },
  { label: "Doc. proprietário", get: (r) => r.owner_doc ?? "" },
  { label: "UF licenc.", get: (r) => r.licensing_uf ?? "" },
  { label: "Exercício licenc.", get: (r) => (r.licensing_year ? String(r.licensing_year) : "") },
  { label: "Emissão CRLV", get: (r) => fmtDate(r.crlv_issue_date) },
  { label: "Município CRLV", get: (r) => r.crlv_city ?? "" },
  { label: "Valor FIPE", get: (r) => fmtMoney(r.fipe_value) },
  { label: "Mês ref. FIPE", get: (r) => r.fipe_reference_month ?? "" },
  { label: "Código FIPE", get: (r) => r.fipe_code ?? "" },
  { label: "Corretor", get: (r) => r.link?.policy?.broker?.name ?? "" },
  { label: "Seguradora", get: (r) => r.link?.policy?.insurer_name ?? r.insurer ?? "" },
  { label: "Tel. seguradora", get: (r) => r.link?.policy?.insurer_phone ?? "" },
  { label: "E-mail seguradora", get: (r) => r.link?.policy?.insurer_email ?? "" },
  { label: "Apólice", get: (r) => r.link?.policy?.policy_number ?? r.insurance_policy ?? "" },
  { label: "Cobertura", get: (r) => r.link?.policy?.coverage_type ?? "" },
  { label: "Início vigência", get: (r) => fmtDate(r.link?.policy?.start_date) },
  { label: "Fim vigência", get: (r) => fmtDate(r.link?.policy?.end_date ?? r.insurance_expires_at) },
  { label: "Prêmio", get: (r) => fmtMoney(r.link?.policy?.total_value) },
  { label: "Franquia", get: (r) => fmtMoney(r.link?.policy?.deductible) },
  { label: "Situação apólice", get: (r) => r.link?.policy?.status ?? "" },
  { label: "Resp. seguro", get: (r) => r.insurance_responsible ?? "" },
  { label: "Observações", get: (r) => r.notes ?? "" },
];

export default function ActiveVehiclesReport() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!currentCompanyId) return;
      if (!opts.silent) setLoading(true);
      const [vRes, lRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select("*")
          .eq("company_id", currentCompanyId)
          .eq("status", "ativo")
          .order("plate", { ascending: true }),
        supabase
          .from("insurance_policy_vehicles")
          .select(
            "vehicle_id, policy:insurance_policies(policy_number,insurer_name,insurer_phone,insurer_email,start_date,end_date,total_value,deductible,coverage_type,coverage_summary,status,broker:insurance_brokers(name))",
          )
          .eq("company_id", currentCompanyId)
          .is("removed_at", null),
      ]);
      if (vRes.error) toast.error("Falha ao carregar veículos");
      if (lRes.error) toast.error("Falha ao carregar apólices");

      const today = new Date().setHours(0, 0, 0, 0);
      const score = (l?: LinkRow) => {
        if (!l) return -Infinity;
        const end = l.policy?.end_date ? new Date(l.policy.end_date).getTime() : null;
        let s = end ?? 0;
        if (end != null && end >= today) s += 1e15;
        if ((l.policy?.status || "").toLowerCase() === "cancelada") s -= 1e16;
        return s;
      };
      const byVehicle = new Map<string, LinkRow>();
      ((lRes.data as any[]) || []).forEach((l: LinkRow) => {
        const cur = byVehicle.get(l.vehicle_id);
        if (!cur || score(l) > score(cur)) byVehicle.set(l.vehicle_id, l);
      });

      setRows((((vRes.data as Vehicle[]) || []) as Row[]).map((v) => ({ ...v, link: byVehicle.get(v.id) ?? null })));
      setLoading(false);
    },
    [currentCompanyId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(
    () => load({ silent: true }),
    ["vehicles", "insurance_policy_vehicles", "insurance_policies", "insurance_brokers"],
    { enabled: !!currentCompanyId },
  );

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase();
    if (!term) return rows;
    return rows.filter((r) => COLUMNS.some((c) => c.get(r).toUpperCase().includes(term)));
  }, [rows, q]);

  function exportCsv() {
    const lines = [COLUMNS.map((c) => c.label).join(";")];
    filtered.forEach((r) => lines.push(COLUMNS.map((c) => csvEscape(c.get(r))).join(";")));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veiculos-ativos-completo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/app/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Relatórios
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <CarFront className="h-7 w-7 text-primary" /> Veículos Ativos — Cadastro Completo
        </h1>
        <p className="text-sm text-muted-foreground">
          Todos os dados cadastrais dos veículos com status ativo, incluindo FIPE, licenciamento e seguro vigente.
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em qualquer campo (placa, chassi, seguradora, proprietário...)"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {filtered.length} de {rows.length} veículos ativos
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum veículo ativo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase font-mono text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2.5">#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.label} className="text-left px-3 py-2.5 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    {COLUMNS.map((c) => (
                      <td key={c.label} className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {c.get(r) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}