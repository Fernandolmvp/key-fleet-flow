import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wrench, Search, AlertTriangle, FileText } from "lucide-react";
import { STATUS_TONE, fmtBRL } from "@/lib/maintenance";
import { EXEC_STATUS } from "@/lib/work-orders";
import { MR_STATUS } from "@/lib/maintenance-requests";

interface Props {
  onNewCorretiva: () => void;
  reloadKey?: number;
}

type Rec = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  workshop_id: string | null;
  workshop_name: string | null;
  cost_center_id: string | null;
  service_at: string;
  km_at_service: number | null;
  category: string | null;
  description: string | null;
  notes: string | null;
  labor_value: number | null;
  parts_value: number | null;
  total_value: number | null;
  status: string;
};

type WO = {
  id: string;
  vehicle_id: string;
  workshop_id: string | null;
  scheduled_date: string | null;
  title: string | null;
  description: string | null;
  execution_status: string;
  quote_amount_total: number | null;
  actual_amount_total: number | null;
};

type Req = {
  id: string;
  vehicle_id: string;
  problem_category: string | null;
  problem_description: string | null;
  scheduled_date: string | null;
  status: string;
  estimated_cost: number | null;
};

export default function CorretivoSection({ onNewCorretiva, reloadKey }: Props) {
  const { currentCompanyId } = useAuth();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [wos, setWos] = useState<WO[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, { plate: string; brand?: string; model?: string }>>({});
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [workshops, setWorkshops] = useState<Record<string, string>>({});
  const [centers, setCenters] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompanyId) return;
    (async () => {
      setLoading(true);
      const [
        { data: r },
        { data: o },
        { data: q2 },
        { data: v },
        { data: d },
        { data: w },
        { data: c },
      ] = await Promise.all([
        supabase
          .from("maintenance_records")
          .select("id,vehicle_id,driver_id,workshop_id,workshop_name,cost_center_id,service_at,km_at_service,category,description,notes,labor_value,parts_value,total_value,status")
          .eq("company_id", currentCompanyId)
          .eq("type", "corretiva")
          .order("service_at", { ascending: false }),
        supabase
          .from("maintenance_work_orders")
          .select("id,vehicle_id,workshop_id,scheduled_date,title,description,execution_status,quote_amount_total,actual_amount_total,problem_category")
          .eq("company_id", currentCompanyId)
          .not("execution_status", "in", "(concluido,cancelado)"),
        supabase
          .from("maintenance_requests")
          .select("id,vehicle_id,problem_category,problem_description,scheduled_date,status,estimated_cost")
          .eq("company_id", currentCompanyId)
          .not("status", "in", "(concluida,cancelada,rejeitada)"),
        supabase.from("vehicles").select("id,plate,brand,model").eq("company_id", currentCompanyId),
        supabase.from("drivers").select("id,full_name").eq("company_id", currentCompanyId),
        supabase.from("workshops" as any).select("id,name,trade_name").eq("company_id", currentCompanyId),
        supabase.from("cost_centers").select("id,name,code").eq("company_id", currentCompanyId),
      ]);
      setRecs((r ?? []) as any);
      // filter WOs heuristically as "corretivas": exclude clearly preventiva
      const woList = ((o ?? []) as any[]).filter((row: any) => {
        const cats: string[] = Array.isArray(row.problem_category) ? row.problem_category : [];
        const blob = cats.join(" ").toLowerCase();
        return !blob.includes("preventiv");
      });
      setWos(woList as any);
      setReqs(((q2 ?? []) as any[]).filter((row: any) => {
        const cat = (row.problem_category ?? "").toLowerCase();
        return !cat.includes("preventiv");
      }) as any);
      const vm: Record<string, any> = {};
      (v ?? []).forEach((x: any) => (vm[x.id] = { plate: x.plate, brand: x.brand, model: x.model }));
      setVehicles(vm);
      const dm: Record<string, string> = {};
      (d ?? []).forEach((x: any) => (dm[x.id] = x.full_name));
      setDrivers(dm);
      const wm: Record<string, string> = {};
      ((w ?? []) as any[]).forEach((x: any) => (wm[x.id] = x.trade_name || x.name));
      setWorkshops(wm);
      const cm: Record<string, string> = {};
      (c ?? []).forEach((x: any) => (cm[x.id] = x.code ? `${x.code} · ${x.name}` : x.name));
      setCenters(cm);
      setLoading(false);
    })();
  }, [currentCompanyId, reloadKey]);

  const filteredRecs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recs;
    return recs.filter((r) => {
      const plate = vehicles[r.vehicle_id]?.plate ?? "";
      const wname = r.workshop_id ? workshops[r.workshop_id] ?? "" : (r.workshop_name ?? "");
      const driver = r.driver_id ? drivers[r.driver_id] ?? "" : "";
      return [plate, wname, driver, r.category ?? "", r.description ?? ""].join(" ").toLowerCase().includes(s);
    });
  }, [recs, q, vehicles, workshops, drivers]);

  const totalSpent = filteredRecs.reduce((a, r) => a + Number(r.total_value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por placa, oficina, motorista..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            {filteredRecs.length} corretiva(s) · {wos.length} OS aberta(s) · {reqs.length} solicitação(ões)
          </span>
          <span className="font-mono font-semibold">{fmtBRL(totalSpent)}</span>
        </div>
        <Button onClick={onNewCorretiva} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Lançar corretiva
        </Button>
      </div>

      {/* Pending requests + open WOs that need action */}
      {(reqs.length > 0 || wos.length > 0) && (
        <div className="surface-card rounded-xl p-4 border border-warning/30 bg-warning/5">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" /> Em andamento — precisa de ação
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {reqs.map((r) => (
              <Link
                key={`req-${r.id}`}
                to="/app/approvals"
                className="rounded-lg p-3 border bg-card hover:bg-muted/30 transition flex items-start gap-3"
              >
                <FileText className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-primary font-semibold">
                      {vehicles[r.vehicle_id]?.plate ?? "—"}
                    </span>
                    <Badge className={`border ${MR_STATUS[r.status]?.color ?? ""}`}>
                      {MR_STATUS[r.status]?.label ?? r.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.problem_description || r.problem_category || "Solicitação"}
                  </div>
                </div>
              </Link>
            ))}
            {wos.map((o) => (
              <Link
                key={`wo-${o.id}`}
                to="/app/oficinas"
                className="rounded-lg p-3 border bg-card hover:bg-muted/30 transition flex items-start gap-3"
              >
                <Wrench className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-primary font-semibold">
                      {vehicles[o.vehicle_id]?.plate ?? "—"}
                    </span>
                    <Badge className={`border ${EXEC_STATUS[o.execution_status]?.color ?? ""}`}>
                      {EXEC_STATUS[o.execution_status]?.label ?? o.execution_status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {o.title || o.description || "Ordem de serviço"}
                    {o.workshop_id && workshops[o.workshop_id] ? ` · ${workshops[o.workshop_id]}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Records list — canonical source (manual + API) */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filteredRecs.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhuma corretiva registrada</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Lance manualmente ou aguarde envios via API. Tudo entra na mesma tabela.
          </p>
        </div>
      ) : (
        <div className="surface-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Oficina</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Mão de obra</TableHead>
                <TableHead className="text-right">Peças</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecs.map((r) => {
                const v = vehicles[r.vehicle_id];
                const wname = r.workshop_id ? workshops[r.workshop_id] : r.workshop_name;
                const driver = r.driver_id ? drivers[r.driver_id] : null;
                const cc = r.cost_center_id ? centers[r.cost_center_id] : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{new Date(r.service_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      {v ? (
                        <Link to={`/app/vehicles/${r.vehicle_id}/historico`} className="font-mono text-primary hover:underline">
                          {v.plate}
                        </Link>
                      ) : "—"}
                      {v?.model && <div className="text-[10px] text-muted-foreground">{[v.brand, v.model].filter(Boolean).join(" ")}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{driver ?? "—"}</TableCell>
                    <TableCell className="text-sm">{wname ?? "—"}</TableCell>
                    <TableCell className="text-xs">{cc ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.category ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.km_at_service?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtBRL(Number(r.labor_value || 0))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtBRL(Number(r.parts_value || 0))}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtBRL(Number(r.total_value || 0))}</TableCell>
                    <TableCell>
                      <Badge className={`capitalize border ${STATUS_TONE[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}