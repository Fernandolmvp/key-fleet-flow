import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtBRL, type TrafficFine } from "@/lib/fines";

type Props = {
  fines: TrafficFine[];
  vehicles: Record<string, any>;
  drivers: Record<string, any>;
};

type Period = "30d" | "90d" | "6m" | "12m" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  "all": "Todo período",
};

const periodCutoff = (p: Period): Date | null => {
  if (p === "all") return null;
  const d = new Date();
  if (p === "30d") d.setDate(d.getDate() - 30);
  if (p === "90d") d.setDate(d.getDate() - 90);
  if (p === "6m") d.setMonth(d.getMonth() - 6);
  if (p === "12m") d.setMonth(d.getMonth() - 12);
  d.setHours(0, 0, 0, 0);
  return d;
};

const csvDownload = (rows: (string | number)[][], filename: string) => {
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function FinesReports({ fines, vehicles, drivers }: Props) {
  const [period, setPeriod] = useState<Period>("90d");

  const filtered = useMemo(() => {
    const cutoff = periodCutoff(period);
    return fines.filter(f => {
      if (f.record_type !== "multa") return false;
      if (!cutoff) return true;
      return new Date(f.infraction_date) >= cutoff;
    });
  }, [fines, period]);

  const byDriver = useMemo(() => {
    const m = new Map<string, { count: number; points: number; total: number; paid: number; pending: number }>();
    filtered.forEach(f => {
      const key = f.driver_id ?? "__none__";
      const cur = m.get(key) ?? { count: 0, points: 0, total: 0, paid: 0, pending: 0 };
      const amt = Number(f.paid_amount ?? f.discount_amount ?? f.amount ?? 0);
      cur.count += 1;
      cur.points += f.license_points || 0;
      cur.total += amt;
      if (f.paid_at) cur.paid += amt; else cur.pending += amt;
      m.set(key, cur);
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, name: id === "__none__" ? "Sem indicação" : (drivers[id]?.full_name ?? "—"), ...v })).sort((a, b) => b.count - a.count);
  }, [filtered, drivers]);

  const byVehicle = useMemo(() => {
    const m = new Map<string, { count: number; points: number; total: number; paid: number; pending: number }>();
    filtered.forEach(f => {
      const key = f.vehicle_id;
      const cur = m.get(key) ?? { count: 0, points: 0, total: 0, paid: 0, pending: 0 };
      const amt = Number(f.paid_amount ?? f.discount_amount ?? f.amount ?? 0);
      cur.count += 1;
      cur.points += f.license_points || 0;
      cur.total += amt;
      if (f.paid_at) cur.paid += amt; else cur.pending += amt;
      m.set(key, cur);
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, plate: vehicles[id]?.plate ?? "—", model: vehicles[id] ? `${vehicles[id].brand ?? ""} ${vehicles[id].model ?? ""}`.trim() : "", ...v })).sort((a, b) => b.count - a.count);
  }, [filtered, vehicles]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    filtered.forEach(f => {
      const d = new Date(f.infraction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = m.get(key) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(f.paid_amount ?? f.discount_amount ?? f.amount ?? 0);
      m.set(key, cur);
    });
    return Array.from(m.entries()).map(([k, v]) => ({ month: k, ...v })).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const totals = useMemo(() => {
    const t = filtered.reduce((acc, f) => {
      const amt = Number(f.paid_amount ?? f.discount_amount ?? f.amount ?? 0);
      acc.total += amt;
      if (f.paid_at) acc.paid += amt; else acc.pending += amt;
      acc.points += f.license_points || 0;
      return acc;
    }, { total: 0, paid: 0, pending: 0, points: 0 });
    return { ...t, count: filtered.length };
  }, [filtered]);

  const exportDriver = () => csvDownload(
    [["Motorista", "Multas", "Pontos", "Total", "Pago", "Pendente"], ...byDriver.map(r => [r.name, r.count, r.points, r.total.toFixed(2), r.paid.toFixed(2), r.pending.toFixed(2)])],
    `multas-por-motorista-${period}.csv`
  );
  const exportVehicle = () => csvDownload(
    [["Placa", "Modelo", "Multas", "Pontos", "Total", "Pago", "Pendente"], ...byVehicle.map(r => [r.plate, r.model, r.count, r.points, r.total.toFixed(2), r.paid.toFixed(2), r.pending.toFixed(2)])],
    `multas-por-veiculo-${period}.csv`
  );
  const exportMonth = () => csvDownload(
    [["Mês", "Multas", "Total"], ...byMonth.map(r => [r.month, r.count, r.total.toFixed(2)])],
    `multas-por-mes-${period}.csv`
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Período:</span>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline">{totals.count} multas</Badge>
        <Badge variant="outline">{totals.points} pontos</Badge>
        <Badge variant="outline">Total {fmtBRL(totals.total)}</Badge>
        <Badge variant="outline" className="text-success border-success/30">Pago {fmtBRL(totals.paid)}</Badge>
        <Badge variant="outline" className="text-warning border-warning/30">Pendente {fmtBRL(totals.pending)}</Badge>
      </div>

      <section className="surface-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Por motorista</h3>
          <Button size="sm" variant="outline" onClick={exportDriver} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>
        {byDriver.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Motorista</TableHead><TableHead className="text-right">Multas</TableHead><TableHead className="text-right">Pontos</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pago</TableHead><TableHead className="text-right">Pendente</TableHead></TableRow></TableHeader>
            <TableBody>{byDriver.map(r => (
              <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{r.points}</TableCell><TableCell className="text-right">{fmtBRL(r.total)}</TableCell><TableCell className="text-right text-success">{fmtBRL(r.paid)}</TableCell><TableCell className="text-right text-warning">{fmtBRL(r.pending)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        )}
      </section>

      <section className="surface-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Por veículo</h3>
          <Button size="sm" variant="outline" onClick={exportVehicle} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>
        {byVehicle.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Placa</TableHead><TableHead>Modelo</TableHead><TableHead className="text-right">Multas</TableHead><TableHead className="text-right">Pontos</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pago</TableHead><TableHead className="text-right">Pendente</TableHead></TableRow></TableHeader>
            <TableBody>{byVehicle.map(r => (
              <TableRow key={r.id}><TableCell className="font-mono">{r.plate}</TableCell><TableCell>{r.model}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{r.points}</TableCell><TableCell className="text-right">{fmtBRL(r.total)}</TableCell><TableCell className="text-right text-success">{fmtBRL(r.paid)}</TableCell><TableCell className="text-right text-warning">{fmtBRL(r.pending)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        )}
      </section>

      <section className="surface-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Por mês</h3>
          <Button size="sm" variant="outline" onClick={exportMonth} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>
        {byMonth.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Multas</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{byMonth.map(r => (
              <TableRow key={r.month}><TableCell>{r.month}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{fmtBRL(r.total)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
