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

type Row = {
  id: string;
  plate: string | null;
  chassis: string | null;
  renavam: string | null;
  licensing_year: number | null;
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

  useEffect(() => {
    if (!currentCompanyId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id,plate,chassis,renavam,licensing_year,brand,model,status")
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

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase();
    return rows.filter((r) => {
      if (yearFilter !== "all") {
        if (yearFilter === "none" ? r.licensing_year != null : String(r.licensing_year ?? "") !== yearFilter) return false;
      }
      if (!term) return true;
      return (
        (r.plate || "").toUpperCase().includes(term) ||
        (r.chassis || "").toUpperCase().includes(term) ||
        (r.renavam || "").includes(term)
      );
    });
  }, [rows, q, yearFilter]);

  function exportCsv() {
    const header = ["Ano Licenciamento", "Placa", "Chassi", "RENAVAM", "Marca/Modelo", "Status"];
    const lines = [header.join(";")];
    filtered.forEach((r) => {
      lines.push(
        [
          r.licensing_year ?? "",
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
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
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
                  <th className="text-left px-4 py-2.5">Ano Lic.</th>
                  <th className="text-left px-4 py-2.5">Placa</th>
                  <th className="text-left px-4 py-2.5">Chassi</th>
                  <th className="text-left px-4 py-2.5">RENAVAM</th>
                  <th className="text-left px-4 py-2.5">Marca / Modelo</th>
                  <th className="text-left px-4 py-2.5">Status</th>
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