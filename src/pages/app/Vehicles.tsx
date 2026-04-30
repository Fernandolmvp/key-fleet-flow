import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Truck, Pencil, Trash2, FileText, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import VehicleDialog from "@/components/dashboard/VehicleDialog";
import { Badge } from "@/components/ui/badge";

interface Vehicle {
  id: string; plate: string; brand: string; model: string; year_model: number | null;
  status: string; current_km: number; fuel_type: string | null; photos: string[];
  documents?: string[] | null;
  licensing_year?: number | null;
  insurer?: string | null;
  insurance_policy?: string | null;
  insurance_expires_at?: string | null;
  owner_name?: string | null;
  crlv_city?: string | null;
  crlv_issue_date?: string | null;
  buyer_name?: string | null;
  sale_value?: number | null;
  sale_date?: string | null;
}

const statusTone: Record<string, string> = {
  ativo: "bg-success/20 text-success border-success/30",
  manutencao: "bg-warning/20 text-warning border-warning/30",
  vendido: "bg-muted text-muted-foreground",
  parado: "bg-destructive/20 text-destructive border-destructive/30",
  sinistrado: "bg-destructive/30 text-destructive border-destructive/40",
  inativo: "bg-muted text-muted-foreground",
  transferido: "bg-muted text-muted-foreground",
  roubado_furtado: "bg-destructive/30 text-destructive border-destructive/40",
  leiloado: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  ativo: "Ativo", manutencao: "Em manutenção", vendido: "Vendido", parado: "Parado",
  sinistrado: "Sinistrado", inativo: "Inativo", transferido: "Transferido",
  roubado_furtado: "Roubado/Furtado", leiloado: "Leiloado",
};

const INACTIVE_STATUSES = ["inativo","sinistrado","transferido","roubado_furtado","leiloado","parado"];

interface DocRow { id: string; entity_id: string; doc_type: string; file_url: string | null; expires_at: string | null; status: string; }

interface PolicyLink {
  vehicle_id: string;
  removed_at: string | null;
  policy: { id: string; status: string; end_date: string | null; file_url: string | null; policy_number: string | null; insurer_name: string | null } | null;
}

export default function Vehicles() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<Vehicle[]>([]);
  const [docsByVehicle, setDocsByVehicle] = useState<Record<string, DocRow[]>>({});
  const [policiesByVehicle, setPoliciesByVehicle] = useState<Record<string, PolicyLink[]>>({});
  const [driverByVehicle, setDriverByVehicle] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("vehicles:view") as "grid" | "list") || "grid");
  const [tab, setTab] = useState<string>(() => localStorage.getItem("vehicles:tab") || "ativos");

  useEffect(() => { localStorage.setItem("vehicles:view", view); }, [view]);
  useEffect(() => { localStorage.setItem("vehicles:tab", tab); }, [tab]);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase.from("vehicles")
      .select("id,plate,brand,model,year_model,status,current_km,fuel_type,photos,documents,licensing_year,insurer,insurance_policy,insurance_expires_at,owner_name,crlv_city,crlv_issue_date,buyer_name,sale_value,sale_date")
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Vehicle[]);

    const { data: docs } = await supabase.from("documents")
      .select("id,entity_id,doc_type,file_url,expires_at,status")
      .eq("company_id", currentCompanyId)
      .eq("entity_type", "vehicle");
    const map: Record<string, DocRow[]> = {};
    (docs ?? []).forEach((d: any) => {
      if (!map[d.entity_id]) map[d.entity_id] = [];
      map[d.entity_id].push(d);
    });
    setDocsByVehicle(map);

    const { data: links } = await supabase.from("insurance_policy_vehicles")
      .select("vehicle_id,removed_at,policy:insurance_policies(id,status,end_date,file_url,policy_number,insurer_name)")
      .eq("company_id", currentCompanyId);
    const pmap: Record<string, PolicyLink[]> = {};
    (links ?? []).forEach((l: any) => {
      if (!pmap[l.vehicle_id]) pmap[l.vehicle_id] = [];
      pmap[l.vehicle_id].push(l);
    });
    setPoliciesByVehicle(pmap);

    // Motorista principal por veículo (motorista com vínculo exclusivo ativo)
    const { data: assigned } = await supabase
      .from("drivers")
      .select("full_name, assigned_vehicle_id, has_assigned_vehicle, status")
      .eq("company_id", currentCompanyId)
      .eq("has_assigned_vehicle", true)
      .not("assigned_vehicle_id", "is", null);
    const dmap: Record<string, string> = {};
    (assigned ?? []).forEach((d: any) => {
      if (["ativo", "ferias"].includes(String(d.status))) {
        dmap[d.assigned_vehicle_id] = d.full_name;
      }
    });
    setDriverByVehicle(dmap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este veículo?")) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Veículo removido");
    load();
  };

  const byTab = items.filter((v) => {
    if (tab === "todos") return true;
    if (tab === "ativos") return v.status === "ativo" || v.status === "manutencao";
    if (tab === "vendidos") return v.status === "vendido";
    if (tab === "inativos") return INACTIVE_STATUSES.includes(v.status);
    return true;
  });

  const filtered = byTab.filter((v) => {
    const needle = q.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!needle) return true;
    const hay = [v.plate, v.brand, v.model, v.owner_name].filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9 ]/g, "");
    return hay.includes(needle) || hay.replace(/\s+/g, "").includes(needle);
  });

  const counts = {
    ativos: items.filter(v => v.status === "ativo" || v.status === "manutencao").length,
    vendidos: items.filter(v => v.status === "vendido").length,
    inativos: items.filter(v => INACTIVE_STATUSES.includes(v.status)).length,
    todos: items.length,
  };

  const currentYear = new Date().getFullYear();
  const findCrlv = (vid: string) => (docsByVehicle[vid] ?? []).find((d) => d.doc_type === "crlv" && d.file_url);
  const findInsurance = (vid: string) => (docsByVehicle[vid] ?? []).find((d) => d.doc_type === "seguro" && d.file_url);

  const findActivePolicy = (vid: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const list = policiesByVehicle[vid] ?? [];
    return list.find((l) => {
      if (l.removed_at && l.removed_at <= today) return false;
      const p = l.policy;
      if (!p) return false;
      if (p.status && p.status !== "ativa") return false;
      if (p.end_date && p.end_date < today) return false;
      return true;
    }) || null;
  };

  const isInsured = (v: Vehicle) => {
    const today = new Date().toISOString().slice(0, 10);
    if (findActivePolicy(v.id)) return true;
    const ins = findInsurance(v.id);
    if (ins?.expires_at) return ins.expires_at >= today;
    if (v.insurance_expires_at) return v.insurance_expires_at >= today;
    return !!(v.insurer && v.insurance_policy);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Veículos</h1>
          <p className="text-muted-foreground">{items.length} veículo(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo veículo
        </Button>
      </div>

      <div className="surface-card rounded-xl p-4">
        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto sm:inline-grid">
            <TabsTrigger value="ativos">Ativos · {counts.ativos}</TabsTrigger>
            <TabsTrigger value="vendidos">Vendidos · {counts.vendidos}</TabsTrigger>
            <TabsTrigger value="inativos">Inativos · {counts.inativos}</TabsTrigger>
            <TabsTrigger value="todos">Todos · {counts.todos}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 font-mono uppercase" placeholder="Pesquisar por placa, marca, modelo ou proprietário" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ml-auto inline-flex rounded-lg border border-border overflow-hidden">
            <Button
              type="button" size="sm" variant={view === "grid" ? "default" : "ghost"}
              className="rounded-none px-3" onClick={() => setView("grid")} title="Visualização em quadrante"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button" size="sm" variant={view === "list" ? "default" : "ghost"}
              className="rounded-none px-3" onClick={() => setView("list")} title="Visualização em lista"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum veículo</h3>
          <p className="text-sm text-muted-foreground mt-1">Cadastre o primeiro veículo da frota.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const crlv = findCrlv(v.id);
            const insurance = findInsurance(v.id);
            const licensed = v.licensing_year === currentYear;
            const insured = isInsured(v);
            const crlvUrl = crlv?.file_url || (v.documents?.[0] ?? null);
            const policyLink = findActivePolicy(v.id);
            const insuranceUrl = policyLink?.policy?.file_url || insurance?.file_url || null;
            const isSold = tab === "vendidos" || v.status === "vendido";
            return (
            <div key={v.id} className="surface-card rounded-xl overflow-hidden hover:border-primary/40 transition-colors group">
              <div className="aspect-video bg-muted/30 relative">
                {v.photos?.[0] ? (
                  <img src={v.photos[0]} alt={v.plate} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full grid place-items-center text-muted-foreground">
                    <Truck className="h-12 w-12 opacity-40" />
                  </div>
                )}
                <Badge className={`absolute top-3 right-3 border ${statusTone[v.status] ?? ""}`}>{statusLabel[v.status] ?? v.status}</Badge>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="font-mono text-lg font-bold tracking-wider text-primary">{v.plate}</div>
                  <div className="text-sm text-muted-foreground">{v.brand} {v.model} {v.year_model ?? ""}</div>
                  {v.owner_name && <div className="text-xs text-muted-foreground mt-0.5 truncate">Prop.: {v.owner_name}</div>}
                  <div className="text-xs mt-0.5 truncate">
                    <span className="text-muted-foreground">Motorista: </span>
                    {driverByVehicle[v.id] ? (
                      <span className="text-foreground font-medium">{driverByVehicle[v.id]}</span>
                    ) : (
                      <span className="text-muted-foreground italic">não possui esse vínculo</span>
                    )}
                  </div>
                </div>

                {isSold ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Comprador:</span>
                      <span className="font-medium text-foreground truncate">{v.buyer_name || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-mono text-foreground">
                        {v.sale_value != null ? v.sale_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                      </span>
                    </div>
                    {v.sale_date && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Data:</span>
                        <span className="text-foreground">{new Date(v.sale_date).toLocaleDateString("pt-BR")}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={`gap-1 ${licensed ? "border-success/40 text-success bg-success/10" : "border-destructive/40 text-destructive bg-destructive/10"}`}>
                      {licensed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {licensed ? `Licenciado ${currentYear}` : v.licensing_year ? `Exerc. ${v.licensing_year}` : "Sem exercício"}
                    </Badge>
                    <Badge variant="outline" className={`gap-1 ${insured ? "border-success/40 text-success bg-success/10" : "border-warning/40 text-warning bg-warning/10"}`}>
                      {insured ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                      {insured ? "Segurado" : "Sem seguro"}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>KM: <span className="font-mono text-foreground">{v.current_km.toLocaleString("pt-BR")}</span></span>
                  <span className="capitalize">{v.fuel_type ?? "—"}</span>
                </div>

                {!isSold && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm" variant="outline" className="flex-1 min-w-[120px]"
                      disabled={!crlvUrl}
                      onClick={() => crlvUrl && window.open(crlvUrl, "_blank")}
                      title={crlvUrl ? "Abrir CRLV anexado" : "Nenhum CRLV anexado"}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" /> {crlvUrl ? "Ver CRLV" : "Sem CRLV"}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="flex-1 min-w-[120px]"
                      disabled={!insuranceUrl}
                      onClick={() => insuranceUrl && window.open(insuranceUrl, "_blank")}
                      title={insuranceUrl ? "Abrir apólice anexada" : "Nenhuma apólice anexada em Documentação"}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> {insuranceUrl ? "Ver apólice" : "Sem apólice"}
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setEditing(v as any); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card rounded-xl overflow-hidden">
          <div className="w-full">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[15%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                {tab === "vendidos" ? (
                  <>
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                  </>
                ) : (
                  <col className="w-[15%]" />
                )}
                <col className="w-[8%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Veículo</th>
                  <th className="text-left px-2 py-2">Proprietário</th>
                  <th className="text-left px-2 py-2">Motorista</th>
                  <th className="text-left px-2 py-2">Status</th>
                  {tab === "vendidos" ? (
                    <>
                      <th className="text-left px-2 py-2">Comprador</th>
                      <th className="text-left px-2 py-2">Valor</th>
                    </>
                  ) : (
                    <th className="text-left px-2 py-2">Lic. / Seguro</th>
                  )}
                  <th className="text-left px-2 py-2">KM</th>
                  <th className="text-right px-2 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const crlv = findCrlv(v.id);
                  const insurance = findInsurance(v.id);
                  const licensed = v.licensing_year === currentYear;
                  const insured = isInsured(v);
                  const crlvUrl = crlv?.file_url || (v.documents?.[0] ?? null);
                  const policyLink = findActivePolicy(v.id);
                  const insuranceUrl = policyLink?.policy?.file_url || insurance?.file_url || null;
                  const isSold = tab === "vendidos" || v.status === "vendido";
                  return (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-9 w-12 rounded bg-muted/30 overflow-hidden grid place-items-center shrink-0">
                            {v.photos?.[0]
                              ? <img src={v.photos[0]} alt="" className="h-full w-full object-cover" />
                              : <Truck className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-primary text-sm">{v.plate}</div>
                            <div className="text-xs text-muted-foreground truncate">{v.brand} {v.model} {v.year_model ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-xs text-foreground truncate">{v.owner_name || "—"}</div>
                      </td>
                      <td className="px-2 py-2">
                        {driverByVehicle[v.id] ? (
                          <div className="text-xs text-foreground truncate">{driverByVehicle[v.id]}</div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic truncate">sem vínculo</div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={`border text-[10px] px-1.5 py-0 ${statusTone[v.status] ?? ""}`}>{statusLabel[v.status] ?? v.status}</Badge>
                      </td>
                      {isSold ? (
                        <>
                          <td className="px-2 py-2 text-xs truncate">{v.buyer_name || "—"}</td>
                          <td className="px-2 py-2 font-mono text-xs truncate">
                            {v.sale_value != null ? v.sale_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                          </td>
                        </>
                      ) : (
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" title={licensed ? `Licenciado ${currentYear}` : v.licensing_year ? `Exercício ${v.licensing_year}` : "Sem exercício"}
                              className={`gap-1 text-[10px] px-1.5 py-0 w-fit ${licensed ? "border-success/40 text-success bg-success/10" : "border-destructive/40 text-destructive bg-destructive/10"}`}>
                              {licensed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {licensed ? `Lic. ${currentYear}` : v.licensing_year ? `${v.licensing_year}` : "Sem"}
                            </Badge>
                            <Badge variant="outline" title={insured ? "Segurado" : "Sem seguro"}
                              className={`gap-1 text-[10px] px-1.5 py-0 w-fit ${insured ? "border-success/40 text-success bg-success/10" : "border-warning/40 text-warning bg-warning/10"}`}>
                              {insured ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                              {insured ? "Seguro" : "Sem seg."}
                            </Badge>
                          </div>
                        </td>
                      )}
                      <td className="px-2 py-2 font-mono text-xs truncate">{v.current_km.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="inline-flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!crlvUrl}
                            onClick={() => crlvUrl && window.open(crlvUrl, "_blank")} title="Ver CRLV">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!insuranceUrl}
                            onClick={() => insuranceUrl && window.open(insuranceUrl, "_blank")} title="Ver apólice">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(v as any); setOpen(true); }} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(v.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <VehicleDialog open={open} onOpenChange={setOpen} vehicle={editing} onSaved={load} />
    </div>
  );
}
