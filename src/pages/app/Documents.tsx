import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, FileText, AlertTriangle, Search, Pencil, Trash2, ExternalLink,
  ShieldAlert, Truck, User, Paperclip, FileWarning, CheckCircle2, ShieldCheck,
} from "lucide-react";
import DocumentDialog, { DocFormDoc } from "@/components/dashboard/DocumentDialog";
import {
  DOC_TYPE_LABELS, STATUS_COLOR, STATUS_LABEL, daysUntil, DocStatus,
  plateLastDigit, MONTH_LABEL_PT,
} from "@/lib/documents";
import {
  loadDetranCalendar, computeLicensingStatus, type DetranCalendar,
  licensingBadgeClass, licensingTooltip,
} from "@/lib/licensing";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTabPermissions } from "@/lib/permissions";
import { openStoredFile } from "@/lib/storage-url";

type DocRow = {
  id: string;
  entity_type: "vehicle" | "driver";
  entity_id: string;
  doc_type: string;
  title: string | null;
  document_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expires_at: string | null;
  status: DocStatus;
  file_url: string | null;
  validation_warning: string | null;
  ai_extracted: any;
};

type Vehicle = { id: string; plate: string; brand: string; model: string; year_model: number | null; licensing_year: number | null; licensing_uf: string | null; vehicle_type: string | null };
type Driver = { id: string; full_name: string; cpf: string | null; cnh_number: string | null; cnh_expires_at: string | null; medical_exam_expires_at: string | null };

export default function Documents() {
  const { currentCompanyId } = useAuth();
  const [tab, setTab] = useState<"vehicles" | "drivers">("vehicles");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocFormDoc | null>(null);
  const [prefill, setPrefill] = useState<Partial<DocFormDoc> | null>(null);
  const [calendar, setCalendar] = useState<DetranCalendar>(() => new Map());

  useEffect(() => { loadDetranCalendar().then(setCalendar); }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const vehiclesPending = useMemo(() => {
    const vDocs = docs.filter((d) => d.entity_type === "vehicle");
    let count = 0;
    vehicles.forEach((v) => {
      if (!vDocs.some((d) => d.entity_id === v.id)) count++;
    });
    vDocs.forEach((d) => {
      if (!d.expires_at) return;
      const exp = new Date(d.expires_at + "T00:00:00");
      const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      if (diff < 0 || diff <= 30) count++;
    });
    return count;
  }, [vehicles, docs, today]);

  const driversPending = useMemo(() => {
    const dDocs = docs.filter((d) => d.entity_type === "driver");
    let count = 0;
    drivers.forEach((dr) => {
      const cnhDoc = dDocs.find((x) => x.entity_id === dr.id && x.doc_type === "cnh");
      const cnhExp = cnhDoc?.expires_at || dr.cnh_expires_at;
      if (!dr.cnh_number && !cnhDoc) {
        count++;
      } else if (cnhExp) {
        const exp = new Date(cnhExp + "T00:00:00");
        const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
        if (diff < 0 || diff <= 30) count++;
      }
      if (dr.medical_exam_expires_at) {
        const exp = new Date(dr.medical_exam_expires_at + "T00:00:00");
        const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
        if (diff < 0 || diff <= 30) count++;
      }
    });
    return count;
  }, [drivers, docs, today]);

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const [d, v, dr] = await Promise.all([
      supabase.from("documents").select("*").eq("company_id", currentCompanyId).order("expires_at", { ascending: true, nullsFirst: false }),
      supabase.from("vehicles").select("id,plate,brand,model,year_model,licensing_year,licensing_uf,vehicle_type").eq("company_id", currentCompanyId).eq("status", "ativo").order("plate"),
      supabase.from("drivers").select("id,full_name,cpf,cnh_number,cnh_expires_at,medical_exam_expires_at").eq("company_id", currentCompanyId).eq("status", "ativo").order("full_name"),
    ]);
    if (d.error) toast.error(d.error.message);
    setDocs((d.data as any[]) || []);
    setVehicles((v.data as any[]) || []);
    setDrivers((dr.data as any[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [currentCompanyId]);

  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "documents", ["vehicles", "drivers"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback as any);
  }, [isVisible, fallback]);

  function openNewFor(prefillData: Partial<DocFormDoc>) {
    setEditing(null);
    setPrefill(prefillData);
    setDialogOpen(true);
  }

  function openEdit(doc: DocRow) {
    setPrefill(null);
    setEditing(doc as any);
    setDialogOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("Excluir este documento?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Documentação</h1>
          <p className="text-sm text-muted-foreground">
            Lista todos os veículos e motoristas cadastrados, com status de anexo, vencimento e licenciamento.
          </p>
        </div>
        <Button onClick={() => openNewFor({})}>
          <Plus className="h-4 w-4" /> Novo documento
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {canViewTab("vehicles") && (
            <TabsTrigger value="vehicles" className="gap-2">
              <Truck className="h-4 w-4" /> Veículos
              {vehiclesPending > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground">
                  {vehiclesPending > 99 ? "99+" : vehiclesPending}
                </span>
              )}
            </TabsTrigger>
          )}
          {canViewTab("drivers") && (
            <TabsTrigger value="drivers" className="gap-2">
              <User className="h-4 w-4" /> Motoristas
              {driversPending > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground">
                  {driversPending > 99 ? "99+" : driversPending}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          <VehiclesTab
            vehicles={vehicles}
            docs={docs.filter((x) => x.entity_type === "vehicle")}
            search={search}
            loading={loading}
            calendar={calendar}
            onAdd={(vehicleId) => openNewFor({ entity_type: "vehicle", entity_id: vehicleId, doc_type: "crlv" })}
            onEdit={openEdit}
            onDelete={remove}
          />
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <DriversTab
            drivers={drivers}
            docs={docs.filter((x) => x.entity_type === "driver")}
            search={search}
            loading={loading}
            onAdd={(driverId) => openNewFor({ entity_type: "driver", entity_id: driverId, doc_type: "cnh" })}
            onEdit={openEdit}
            onDelete={remove}
          />
        </TabsContent>
      </Tabs>

      {currentCompanyId && (
        <DocumentDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setPrefill(null); }}
          companyId={currentCompanyId}
          doc={editing || (prefill as DocFormDoc | null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

/* ----------------------- Veículos ----------------------- */

function VehiclesTab({
  vehicles, docs, search, loading, calendar, onAdd, onEdit, onDelete,
}: {
  vehicles: Vehicle[];
  docs: DocRow[];
  search: string;
  loading: boolean;
  calendar: DetranCalendar;
  onAdd: (vehicleId: string) => void;
  onEdit: (d: DocRow) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = useMemo(() => vehicles.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [v.plate, v.brand, v.model].join(" ").toLowerCase().includes(q);
  }), [vehicles, search]);

  // KPIs
  const stats = useMemo(() => {
    let semDoc = 0, atrasados = 0, venceEmBreve = 0, ok = 0;
    vehicles.forEach((v) => {
      const vDocs = docs.filter((d) => d.entity_id === v.id);
      const lic = computeLicensingStatus({
        licensing_year: v.licensing_year, plate: v.plate, uf: v.licensing_uf,
        calendar, vehicle_type: v.vehicle_type,
      });
      if (vDocs.length === 0) semDoc++;
      if (lic.status === "vencido") atrasados++;
      else if (lic.status === "vencendo") venceEmBreve++;
      else if (lic.status === "licenciado") ok++;
    });
    return { semDoc, atrasados, venceEmBreve, ok, total: vehicles.length };
  }, [vehicles, docs, calendar]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Veículos</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Sem documentos</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground flex items-center gap-2"><FileWarning className="h-5 w-5" />{stats.semDoc}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Licenciados</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />{stats.ok}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vence em breve</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{stats.venceEmBreve}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Atrasados</div>
          <div className="text-2xl font-bold mt-1 text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{stats.atrasados}</div>
        </Card>
      </div>

      <LicensingCalendarReference />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Veículo</th>
                <th className="text-left px-4 py-3">Final</th>
                <th className="text-left px-4 py-3">Licenciamento (Calendário BR)</th>
                <th className="text-left px-4 py-3">Documentos anexados</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum veículo cadastrado.</td></tr>
              )}
              {filtered.map((v) => {
                const vDocs = docs.filter((d) => d.entity_id === v.id);
                const crlv = vDocs.find((d) => d.doc_type === "crlv");
                const lic = computeLicensingStatus({
                  licensing_year: v.licensing_year, plate: v.plate, uf: v.licensing_uf,
                  calendar, vehicle_type: v.vehicle_type,
                });
                const last = plateLastDigit(v.plate);
                const monthIdx = lic.vencimento ? lic.vencimento.getMonth() + 1 : null;
                const licYear = lic.vencimento ? lic.vencimento.getFullYear() : null;
                const licLabel =
                  lic.status === "licenciado" ? "Licenciado"
                  : lic.status === "vencendo" ? "Vence em breve"
                  : lic.status === "vencido" ? "Vencido"
                  : "Sem exercício";
                const adjustedDocs = vDocs.map((d) => {
                  if (d.doc_type !== "crlv" && d.doc_type !== "licenciamento") return d;
                  if (!lic.vencimento) return d;
                  const iso = `${lic.vencimento.getFullYear()}-${String(lic.vencimento.getMonth()+1).padStart(2,"0")}-${String(lic.vencimento.getDate()).padStart(2,"0")}`;
                  const status: DocStatus = lic.status === "vencido" ? "vencido" : lic.status === "vencendo" ? "vencendo" : "valido";
                  return { ...d, expires_at: d.expires_at || iso, status };
                });

                return (
                  <tr key={v.id} className="border-t border-border align-top hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-primary">{v.plate}</div>
                      <div className="text-xs text-muted-foreground">{v.brand} {v.model} {v.year_model || ""}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{last || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        title={licensingTooltip(lic)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${licensingBadgeClass(lic)}`}
                      >
                        {licLabel}
                      </span>
                      <div className="text-xs text-muted-foreground mt-1">
                        {monthIdx && licYear ? `Prazo: ${MONTH_LABEL_PT[monthIdx]}/${licYear}` : v.licensing_year ? "—" : "Sem exercício informado"}
                        {!crlv && lic.status !== "sem" && (
                          <span className="block text-amber-400">Baseado no calendário (sem CRLV anexado).</span>
                        )}
                        {crlv?.expires_at && (
                          <span className="block">CRLV até {format(new Date(crlv.expires_at + "T00:00:00"), "dd/MM/yyyy")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {adjustedDocs.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-400 text-xs">
                          <FileWarning className="h-4 w-4" /> Nenhum documento anexado.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {adjustedDocs.map((d) => (
                            <DocLine key={d.id} d={d} onEdit={onEdit} onDelete={onDelete} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => onAdd(v.id)}>
                        <Plus className="h-3.5 w-3.5" /> Anexar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------- Motoristas ----------------------- */

function DriversTab({
  drivers, docs, search, loading, onAdd, onEdit, onDelete,
}: {
  drivers: Driver[];
  docs: DocRow[];
  search: string;
  loading: boolean;
  onAdd: (driverId: string) => void;
  onEdit: (d: DocRow) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = useMemo(() => drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [d.full_name, d.cpf || "", d.cnh_number || ""].join(" ").toLowerCase().includes(q);
  }), [drivers, search]);

  const stats = useMemo(() => {
    let semDoc = 0, vencidos = 0, vencendo = 0, ok = 0;
    drivers.forEach((dr) => {
      const dDocs = docs.filter((x) => x.entity_id === dr.id);
      if (dDocs.length === 0) semDoc++;
      const cnh = dDocs.find((x) => x.doc_type === "cnh");
      const cnhExp = cnh?.expires_at || dr.cnh_expires_at;
      const dl = daysUntil(cnhExp);
      if (dl !== null) {
        if (dl < 0) vencidos++;
        else if (dl <= 30) vencendo++;
        else ok++;
      }
    });
    return { semDoc, vencidos, vencendo, ok, total: drivers.length };
  }, [drivers, docs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Motoristas</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2"><User className="h-5 w-5 text-primary" />{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Sem documentos</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground flex items-center gap-2"><FileWarning className="h-5 w-5" />{stats.semDoc}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">CNH válida</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{stats.ok}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">CNH vencendo</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{stats.vencendo}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">CNH vencida</div>
          <div className="text-2xl font-bold mt-1 text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{stats.vencidos}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Motorista</th>
                <th className="text-left px-4 py-3">CNH</th>
                <th className="text-left px-4 py-3">Documentos anexados</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum motorista cadastrado.</td></tr>
              )}
              {filtered.map((dr) => {
                const dDocs = docs.filter((x) => x.entity_id === dr.id);
                const cnh = dDocs.find((x) => x.doc_type === "cnh");
                const cnhExp = cnh?.expires_at || dr.cnh_expires_at;
                const dl = daysUntil(cnhExp);
                let cnhStatus: { label: string; cls: string } = { label: "Sem informação", cls: "bg-muted/30 text-muted-foreground border-border" };
                if (dl !== null) {
                  if (dl < 0) cnhStatus = { label: `Vencida há ${Math.abs(dl)}d`, cls: "bg-destructive/15 text-destructive border-destructive/30" };
                  else if (dl <= 30) cnhStatus = { label: `Vence em ${dl}d`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
                  else cnhStatus = { label: `Válida (${dl}d)`, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
                }
                return (
                  <tr key={dr.id} className="border-t border-border align-top hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{dr.full_name}</div>
                      <div className="text-xs text-muted-foreground">CPF: {dr.cpf || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{dr.cnh_number || "—"}</div>
                      <Badge variant="outline" className={`${cnhStatus.cls} mt-1`}>{cnhStatus.label}</Badge>
                      {cnhExp && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Até {format(new Date(cnhExp + "T00:00:00"), "dd/MM/yyyy")}
                        </div>
                      )}
                      {!cnh && dr.cnh_expires_at && (
                        <div className="text-xs text-amber-400 mt-1">Sem CNH digitalizada anexada.</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {dDocs.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-400 text-xs">
                          <FileWarning className="h-4 w-4" /> Nenhum documento anexado.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {dDocs.map((d) => <DocLine key={d.id} d={d} onEdit={onEdit} onDelete={onDelete} />)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => onAdd(dr.id)}>
                        <Plus className="h-3.5 w-3.5" /> Anexar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------- Item de documento (linha) ----------------------- */

function DocLine({ d, onEdit, onDelete }: { d: DocRow; onEdit: (d: DocRow) => void; onDelete: (id: string) => void }) {
  const dl = daysUntil(d.expires_at);
  return (
    <div className="flex items-center gap-2 text-xs">
      <Paperclip className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{DOC_TYPE_LABELS[d.doc_type] || d.doc_type}</span>
      {d.document_number && <span className="text-muted-foreground font-mono">#{d.document_number}</span>}
      <Badge className={STATUS_COLOR[d.status]} variant="outline">
        {STATUS_LABEL[d.status]}{dl !== null ? ` · ${dl < 0 ? `${Math.abs(dl)}d atrás` : `${dl}d`}` : ""}
      </Badge>
      {d.validation_warning && (
        <span className="text-amber-400 flex items-center gap-1"><ShieldAlert className="h-3 w-3" />{d.validation_warning}</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {d.file_url && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStoredFile(d.file_url)}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(d)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(d.id)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

/* ----------------- Tabela de referência: vencimentos SP ----------------- */

function LicensingCalendarReference() {
  const leve = [
    { finais: "1 e 2", mes: "Julho" },
    { finais: "3 e 4", mes: "Agosto" },
    { finais: "5 e 6", mes: "Setembro" },
    { finais: "7 e 8", mes: "Outubro" },
    { finais: "9", mes: "Novembro" },
    { finais: "0", mes: "Dezembro" },
  ];
  const pesado = [
    { finais: "1 e 2", mes: "Setembro" },
    { finais: "3, 4 e 5", mes: "Outubro" },
    { finais: "6, 7 e 8", mes: "Novembro" },
    { finais: "9 e 0", mes: "Dezembro" },
  ];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold">Calendário de licenciamento — SP</div>
          <div className="text-xs text-muted-foreground">
            Classificação automática pelo tipo do veículo (CRLV). Leves = carros, motos, ônibus e reboques. Pesados = caminhões e tratores.
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Carros, Motos, Ônibus e Reboques</div>
          <table className="w-full text-sm border border-border rounded">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-3 py-1.5">Final da placa</th><th className="text-left px-3 py-1.5">Vencimento</th></tr>
            </thead>
            <tbody>
              {leve.map((r) => (
                <tr key={r.finais} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono">{r.finais}</td>
                  <td className="px-3 py-1.5">Até o último dia de {r.mes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Caminhões e Tratores</div>
          <table className="w-full text-sm border border-border rounded">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-3 py-1.5">Final da placa</th><th className="text-left px-3 py-1.5">Vencimento</th></tr>
            </thead>
            <tbody>
              {pesado.map((r) => (
                <tr key={r.finais} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono">{r.finais}</td>
                  <td className="px-3 py-1.5">Até o último dia de {r.mes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}