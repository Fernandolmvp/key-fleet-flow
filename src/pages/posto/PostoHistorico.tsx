import { useEffect, useMemo, useState } from "react";
import { Loader2, Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePostoAuth } from "@/contexts/PostoAuthContext";

type Row = {
  id: string; fueled_at: string; liters: number; total_value: number; price_per_liter: number;
  notes: string | null; receipt_url: string | null;
  vehicle: { plate: string; brand: string; model: string } | null;
  driver: { full_name: string } | null;
  company: { name: string } | null;
};

function fmt(n: number) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(n); }
function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function PostoHistorico() {
  const { authedFetch, station } = usePostoAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
      if (plate) params.set("plate", plate);
      if (driver) params.set("driver", driver);
      const res = await authedFetch<{ rows: Row[] }>(`posto-list?${params.toString()}`);
      setRows(res.rows);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const totals = useMemo(() => ({
    qtd: rows.length,
    liters: rows.reduce((s, r) => s + Number(r.liters), 0),
    value: rows.reduce((s, r) => s + Number(r.total_value), 0),
  }), [rows]);

  const exportCsv = () => {
    const head = ["Data","Placa","Veículo","Motorista","Empresa","Litros","R$/L","Total","Cupom"];
    const lines = rows.map((r) => [
      new Date(r.fueled_at).toLocaleString("pt-BR"),
      r.vehicle?.plate ?? "",
      `${r.vehicle?.brand ?? ""} ${r.vehicle?.model ?? ""}`.trim(),
      r.driver?.full_name ?? "",
      r.company?.name ?? "",
      String(r.liters).replace(".", ","),
      String(r.price_per_liter).replace(".", ","),
      String(r.total_value).replace(".", ","),
      r.notes ?? "",
    ]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `abastecimentos-${station?.name ?? "posto"}-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const html = `
      <html><head><meta charset="utf-8"><title>Histórico ${escHtml(station?.name)}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{margin:0 0 4px}h2{font-size:14px;color:#555;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#f3f4f6}tfoot td{font-weight:bold;background:#f9fafb}</style></head>
      <body>
      <h1>Histórico de abastecimentos</h1>
      <h2>${escHtml(station?.name)} ${station?.cnpj ? "· CNPJ " + escHtml(station.cnpj) : ""}</h2>
      <table>
        <thead><tr><th>Data</th><th>Placa</th><th>Motorista</th><th>Empresa</th><th>Litros</th><th>R$/L</th><th>Total</th><th>Cupom</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td>${escHtml(new Date(r.fueled_at).toLocaleString("pt-BR"))}</td>
          <td>${escHtml(r.vehicle?.plate)}</td>
          <td>${escHtml(r.driver?.full_name)}</td>
          <td>${escHtml(r.company?.name)}</td>
          <td>${fmt(Number(r.liters))}</td>
          <td>R$ ${fmt(Number(r.price_per_liter))}</td>
          <td>R$ ${fmt(Number(r.total_value))}</td>
          <td>${escHtml(r.notes)}</td>
        </tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="4">Total — ${totals.qtd} abastecimentos</td>
          <td>${fmt(totals.liters)}</td><td></td><td>R$ ${fmt(totals.value)}</td><td></td></tr></tfoot>
      </table>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Placa</Label><Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} /></div>
        <div className="space-y-1"><Label className="text-xs">Motorista</Label><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></div>
        <Button onClick={load} disabled={loading} className="gap-2 bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Filtrar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card rounded-xl p-4"><div className="text-xs text-muted-foreground">Abastecimentos</div><div className="text-2xl font-bold">{totals.qtd}</div></div>
        <div className="surface-card rounded-xl p-4"><div className="text-xs text-muted-foreground">Litros totais</div><div className="text-2xl font-bold">{fmt(totals.liters)}</div></div>
        <div className="surface-card rounded-xl p-4"><div className="text-xs text-muted-foreground">Valor total</div><div className="text-2xl font-bold">R$ {fmt(totals.value)}</div></div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={exportCsv} className="gap-2"><FileSpreadsheet className="h-4 w-4" />Excel/CSV</Button>
        <Button variant="outline" onClick={exportPdf} className="gap-2"><FileText className="h-4 w-4" />PDF</Button>
      </div>

      <div className="surface-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Placa</th>
                <th className="text-left px-3 py-2">Motorista</th>
                <th className="text-left px-3 py-2">Empresa</th>
                <th className="text-right px-3 py-2">Litros</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Cupom</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro no período</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{new Date(r.fueled_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 font-mono">{r.vehicle?.plate}</td>
                  <td className="px-3 py-2">{r.driver?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{r.company?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(Number(r.liters))}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">R$ {fmt(Number(r.total_value))}</td>
                  <td className="px-3 py-2 text-xs">{r.notes?.replace("Cupom fiscal: ","") ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-primary"><Download className="h-4 w-4" /></a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}