import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, Search, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeLicensingStatus,
  useDetranCalendar,
  licensingBadgeText,
  licensingBadgeClass,
  licensingTooltip,
  type LicensingStatus,
} from "@/lib/licensing";

type Row = {
  id: string;
  plate: string | null;
  chassis: string | null;
  renavam: string | null;
  licensing_year: number | null;
  licensing_uf: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  status: string | null;
};

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function LicensingReport() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [situacaoFilter, setSituacaoFilter] = useState<"all" | LicensingStatus>("all");
  const calendar = useDetranCalendar();

  useEffect(() => {
    if (!currentCompanyId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id,plate,chassis,renavam,licensing_year,licensing_uf,vehicle_type,brand,model,status")
        .eq("company_id", currentCompanyId)
        .order("plate", { ascending: true });
      if (error) toast.error("Falha ao carregar veículos");
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, [currentCompanyId]);

  const years = useMemo(() => {
    const s = new Set<number>();
    rows.forEach((r) => r.licensing_year && s.add(r.licensing_year));
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const lic = computeLicensingStatus({
        licensing_year: r.licensing_year,
        plate: r.plate,
        uf: r.licensing_uf,
        calendar,
        vehicle_type: r.vehicle_type,
      });
      return { ...r, lic };
    });
  }, [rows, calendar]);

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase();
    const list = enriched.filter((r) => {
      if (yearFilter !== "all") {
        if (yearFilter === "none" ? r.licensing_year != null : String(r.licensing_year ?? "") !== yearFilter) return false;
      }
      if (situacaoFilter !== "all" && r.lic.status !== situacaoFilter) return false;
      if (!term) return true;
      return (
        (r.plate || "").toUpperCase().includes(term) ||
        (r.chassis || "").toUpperCase().includes(term) ||
        (r.renavam || "").includes(term)
      );
    });
    // Ordenação por urgência: vencido (mais antigo primeiro), vencendo (mais próximo),
    // licenciado, sem.
    const rank: Record<LicensingStatus, number> = {
      vencido: 0, vencendo: 1, licenciado: 2, sem: 3,
    };
    list.sort((a, b) => {
      const ra = rank[a.lic.status];
      const rb = rank[b.lic.status];
      if (ra !== rb) return ra - rb;
      const ta = a.lic.vencimento?.getTime() ?? 0;
      const tb = b.lic.vencimento?.getTime() ?? 0;
      if (a.lic.status === "vencido") return ta - tb; // mais antigo primeiro
      if (a.lic.status === "vencendo") return ta - tb; // mais próximo primeiro
      return (a.plate || "").localeCompare(b.plate || "");
    });
    return list;
  }, [enriched, q, yearFilter, situacaoFilter]);

  const isActive = (s: string | null) => {
    const v = (s || "").toLowerCase();
    return v !== "vendido" && v !== "inativo" && v !== "baixado";
  };

  const counts = useMemo(() => {
    let venc = 0, vencendo = 0, lic = 0, sem = 0;
    for (const r of filtered) {
      const active = isActive(r.status);
      if (r.lic.status === "vencido" && active) venc++;
      else if (r.lic.status === "vencendo" && active) vencendo++;
      else if (r.lic.status === "licenciado") lic++;
      else if (r.lic.status === "sem") sem++;
    }
    return { venc, vencendo, lic, sem };
  }, [filtered]);

  const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");
  const situacaoText = (lic: ReturnType<typeof computeLicensingStatus>) => {
    if (lic.status === "sem") return "Sem exercício";
    if (lic.status === "licenciado") return "Licenciado";
    if (lic.status === "vencendo") return `A vencer ${lic.mesAno}`;
    return `Vencido ${lic.mesAno}`;
  };

  function exportCsv() {
    const header = ["Ano Licenciamento", "Situação", "Vencimento", "Placa", "Chassi", "RENAVAM", "Marca/Modelo", "Status veículo"];
    const lines = [header.join(";")];
    filtered.forEach((r) => {
      lines.push(
        [
          r.licensing_year ?? "",
          situacaoText(r.lic),
          fmtDate(r.lic.vencimento),
          r.plate ?? "",
          r.chassis ?? "",
          r.renavam ?? "",
          [r.brand, r.model].filter(Boolean).join(" "),
          r.status ?? "",
        ]
          .map(csvEscape)
          .join(";"),
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `licenciamento-frota-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <FileText className="h-7 w-7 text-primary" /> Licenciamento de Veículos
        </h1>
        <p className="text-sm text-muted-foreground">
          Lista de veículos com ano de licenciamento, placa, chassi e RENAVAM.
        </p>
      </div>

      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, chassi ou RENAVAM..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="all">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
            <option value="none">Sem licenciamento</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={situacaoFilter}
            onChange={(e) => setSituacaoFilter(e.target.value as any)}
            aria-label="Situação do licenciamento"
          >
            <option value="all">Todas as situações</option>
            <option value="vencido">Vencidos</option>
            <option value="vencendo">A vencer</option>
            <option value="licenciado">Licenciados</option>
            <option value="sem">Sem exercício</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{filtered.length} de {rows.length} veículos</span>
          <span className="text-muted-foreground">·</span>
          <span className="px-2 py-0.5 rounded-full border border-destructive/40 text-destructive bg-destructive/10 font-medium">{counts.venc} vencidos</span>
          <span className="px-2 py-0.5 rounded-full border border-warning/40 text-warning bg-warning/10 font-medium">{counts.vencendo} a vencer</span>
          <span className="px-2 py-0.5 rounded-full border border-success/40 text-success bg-success/10 font-medium">{counts.lic} licenciados</span>
          <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground bg-muted/30 font-medium">{counts.sem} sem exercício</span>
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
                  <th className="text-left px-4 py-2.5">Ano Lic.</th>
                  <th className="text-left px-4 py-2.5">Situação</th>
                  <th className="text-left px-4 py-2.5">Vencimento</th>
                  <th className="text-left px-4 py-2.5">Placa</th>
                  <th className="text-left px-4 py-2.5">Chassi</th>
                  <th className="text-left px-4 py-2.5">RENAVAM</th>
                  <th className="text-left px-4 py-2.5">Marca / Modelo</th>
                  <th className="text-left px-4 py-2.5">Status veículo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      {r.licensing_year ? (
                        <Badge variant="outline" className="font-mono">
                          {r.licensing_year}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        title={licensingTooltip(r.lic)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${licensingBadgeClass(r.lic)}`}
                      >
                        {situacaoText(r.lic)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtDate(r.lic.vencimento)}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold">{r.plate || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.chassis || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.renavam || "—"}</td>
                    <td className="px-4 py-2.5">
                      {[r.brand, r.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs capitalize">{r.status || "—"}</span>
                    </td>
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