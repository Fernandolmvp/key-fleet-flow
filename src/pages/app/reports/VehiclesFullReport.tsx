import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Printer, Search, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type VehicleRow = {
  id: string;
  plate: string | null;
  chassis: string | null;
  renavam: string | null;
  year_manufacture: number | null;
  year_model: number | null;
  color: string | null;
  brand: string | null;
  model: string | null;
  insurer: string | null;
  insurance_policy: string | null;
  fipe_value: number | null;
  fipe_reference_month: string | null;
  fipe_value_updated_at: string | null;
  owner_name: string | null;
  insurance_expires_at: string | null;
};

type LinkRow = {
  vehicle_id: string;
  removed_at: string | null;
  policy: {
    policy_number: string | null;
    insurer_name: string | null;
    end_date: string | null;
    status: string | null;
    broker: { name: string | null } | null;
  } | null;
};

type Row = VehicleRow & {
  broker_name: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  policy_end_date: string | null;
};

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function VehiclesFullReport() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!currentCompanyId) return;
      if (!opts.silent) setLoading(true);
      const [vRes, lRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select(
            "id,plate,chassis,renavam,year_manufacture,year_model,color,brand,model,insurer,insurance_policy,insurance_expires_at,fipe_value,fipe_reference_month,fipe_value_updated_at,owner_name",
          )
          .eq("company_id", currentCompanyId)
          .order("plate", { ascending: true }),
        supabase
          .from("insurance_policy_vehicles")
          .select(
            "vehicle_id, removed_at, policy:insurance_policies(policy_number,insurer_name,end_date,status,broker:insurance_brokers(name))",
          )
          .eq("company_id", currentCompanyId)
          .is("removed_at", null),
      ]);
      if (vRes.error) toast.error("Falha ao carregar veículos");
      if (lRes.error) toast.error("Falha ao carregar apólices");

      const linksByVehicle = new Map<string, LinkRow>();
      const today = new Date().setHours(0, 0, 0, 0);
      const score = (l: LinkRow | undefined) => {
        if (!l) return -Infinity;
        const end = l.policy?.end_date ? new Date(l.policy.end_date).getTime() : null;
        const cancelada = (l.policy?.status || "").toLowerCase() === "cancelada";
        // prioriza apólice vigente, depois a de vencimento mais distante
        let s = end ?? 0;
        if (end != null && end >= today) s += 1e15;
        if (cancelada) s -= 1e16;
        return s;
      };
      ((lRes.data as any[]) || []).forEach((l) => {
        const existing = linksByVehicle.get(l.vehicle_id);
        if (!existing || score(l as LinkRow) > score(existing)) {
          linksByVehicle.set(l.vehicle_id, l as LinkRow);
        }
      });

      const combined: Row[] = ((vRes.data as VehicleRow[]) || []).map((v) => {
        const link = linksByVehicle.get(v.id);
        return {
          ...v,
          broker_name: link?.policy?.broker?.name ?? null,
          insurer_name: link?.policy?.insurer_name ?? v.insurer ?? null,
          policy_number: link?.policy?.policy_number ?? v.insurance_policy ?? null,
          policy_end_date: link?.policy?.end_date ?? v.insurance_expires_at ?? null,
        };
      });
      setRows(combined);
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
    return rows.filter((r) =>
      [
        r.plate,
        r.chassis,
        r.renavam,
        r.brand,
        r.model,
        r.color,
        r.broker_name,
        r.insurer_name,
        r.policy_number,
        r.owner_name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toUpperCase().includes(term)),
    );
  }, [rows, q]);

  function anoModelo(r: Row) {
    if (!r.year_manufacture && !r.year_model) return "";
    return `${r.year_manufacture ?? "—"}/${r.year_model ?? "—"}`;
  }

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function fmtFipe(v: number | null) {
    return v == null ? "—" : brl.format(Number(v));
  }
  function fmtUpdatedAt(d: string | null) {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("pt-BR");
    } catch {
      return "";
    }
  }

  function fmtDate(d: string | null) {
    if (!d) return "";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${day}/${m}/${y}` : "";
  }

  function exportCsv() {
    const header = [
      "Placa",
      "Chassi",
      "RENAVAM",
      "Ano/Modelo",
      "Marca/Modelo",
      "Cor",
      "Proprietário",
      "Valor FIPE",
      "Mês Ref. FIPE",
      "Corretor",
      "Seguradora",
      "Apólice",
      "Fim vigência",
    ];
    const lines = [header.join(";")];
    filtered.forEach((r) => {
      lines.push(
        [
          r.plate ?? "",
          r.chassis ?? "",
          r.renavam ?? "",
          anoModelo(r),
          [r.brand, r.model].filter(Boolean).join(" "),
          r.color ?? "",
          r.owner_name ?? "",
          r.fipe_value != null ? brl.format(Number(r.fipe_value)) : "",
          r.fipe_reference_month ?? "",
          r.broker_name ?? "",
          r.insurer_name ?? "",
          r.policy_number ?? "",
          fmtDate(r.policy_end_date),
        ]
          .map(csvEscape)
          .join(";"),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veiculos-completo-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <FileText className="h-7 w-7 text-primary" /> Veículos — Dados Completos
        </h1>
        <p className="text-sm text-muted-foreground">
          Placa, chassi, RENAVAM, ano/modelo, cor, corretor, seguradora e número da apólice.
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, chassi, RENAVAM, corretor, seguradora..."
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
          {filtered.length} de {rows.length} veículos
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum veículo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase font-mono text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2.5">Placa</th>
                  <th className="text-left px-3 py-2.5">Chassi</th>
                  <th className="text-left px-3 py-2.5">RENAVAM</th>
                  <th className="text-left px-3 py-2.5">Ano/Mod.</th>
                  <th className="text-left px-3 py-2.5">Marca / Modelo</th>
                  <th className="text-left px-3 py-2.5">Cor</th>
                  <th className="text-left px-3 py-2.5">Proprietário</th>
                  <th className="text-left px-3 py-2.5">Valor FIPE</th>
                  <th className="text-left px-3 py-2.5">Mês Ref.</th>
                  <th className="text-left px-3 py-2.5">Corretor</th>
                  <th className="text-left px-3 py-2.5">Seguradora</th>
                  <th className="text-left px-3 py-2.5">Apólice</th>
                  <th className="text-left px-3 py-2.5">Fim vigência</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-mono font-semibold">{r.plate || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.chassis || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.renavam || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{anoModelo(r) || "—"}</td>
                    <td className="px-3 py-2.5">{[r.brand, r.model].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-2.5">{r.color || "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{r.owner_name || "—"}</td>
                    <td
                      className="px-3 py-2.5 font-mono text-xs whitespace-nowrap"
                      title={r.fipe_value_updated_at ? `Consultado em ${fmtUpdatedAt(r.fipe_value_updated_at)}` : undefined}
                    >
                      {fmtFipe(r.fipe_value)}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.fipe_reference_month || "—"}</td>
                    <td className="px-3 py-2.5">{r.broker_name || "—"}</td>
                    <td className="px-3 py-2.5">{r.insurer_name || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.policy_number || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{fmtDate(r.policy_end_date) || "—"}</td>
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