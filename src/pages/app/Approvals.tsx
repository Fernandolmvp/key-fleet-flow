import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldCheck, Truck, Clock, User, MapPin, Fuel, CheckCircle2, XCircle,
  AlertTriangle, Loader2, FileCheck, Image as ImageIcon, Receipt, Gauge, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/permissions";

interface AuthRow {
  id: string;
  status: string;
  authorization_code: string | null;
  vehicle_id: string;
  driver_id: string | null;
  fuel_station_id: string | null;
  station_name: string | null;
  estimated_liters: number | null;
  estimated_value: number | null;
  fuel_type: string | null;
  km_at_request: number | null;
  km_photo_url: string | null;
  plate_photo_url: string | null;
  plate_recognized: string | null;
  receipt_photo_url: string | null;
  receipt_cnpj: string | null;
  receipt_total: number | null;
  cnpj_match: boolean | null;
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
  requested_by: string;
}

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-warning/20 text-warning border-warning/30",
  aprovada: "bg-success/20 text-success border-success/30",
  recusada: "bg-destructive/20 text-destructive border-destructive/30",
  utilizada: "bg-primary/20 text-primary border-primary/30",
  expirada: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export default function Approvals() {
  const { currentCompanyId, user, isManager } = useAuth();
  const { can } = usePermissions();
  const [auths, setAuths] = useState<AuthRow[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const [stations, setStations] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState("pendente");

  const [detail, setDetail] = useState<AuthRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data: a } = await supabase
      .from("fuel_authorizations")
      .select("*")
      .eq("company_id", currentCompanyId)
      .order("requested_at", { ascending: false })
      .limit(200);
    const list = (a ?? []) as AuthRow[];
    setAuths(list);

    const vIds = [...new Set(list.map((x) => x.vehicle_id).filter(Boolean))];
    const dIds = [...new Set(list.map((x) => x.driver_id).filter(Boolean) as string[])];
    const sIds = [...new Set(list.map((x) => x.fuel_station_id).filter(Boolean) as string[])];
    const uIds = [...new Set(list.map((x) => x.requested_by).filter(Boolean))];
    const aIds = list.map((x) => x.id);

    const [{ data: v }, { data: d }, { data: s }, { data: p }, { data: it }] = await Promise.all([
      vIds.length ? supabase.from("vehicles").select("id,plate,brand,model,fuel_type,current_km").in("id", vIds) : Promise.resolve({ data: [] as any[] }),
      dIds.length ? supabase.from("drivers").select("id,full_name,cpf,phone,auto_fuel_authorized").in("id", dIds) : Promise.resolve({ data: [] as any[] }),
      sIds.length ? supabase.from("fuel_stations").select("id,name,cnpj,brand,city,state").in("id", sIds) : Promise.resolve({ data: [] as any[] }),
      uIds.length ? supabase.from("profiles").select("id,full_name").in("id", uIds) : Promise.resolve({ data: [] as any[] }),
      aIds.length ? supabase.from("fuel_authorization_items").select("*").in("authorization_id", aIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    setVehicles(Object.fromEntries((v ?? []).map((x: any) => [x.id, x])));
    setDrivers(Object.fromEntries((d ?? []).map((x: any) => [x.id, x])));
    setStations(Object.fromEntries((s ?? []).map((x: any) => [x.id, x])));
    setProfiles(Object.fromEntries((p ?? []).map((x: any) => [x.id, x])));
    const grouped: Record<string, any[]> = {};
    (it ?? []).forEach((x: any) => {
      grouped[x.authorization_id] = grouped[x.authorization_id] ?? [];
      grouped[x.authorization_id].push(x);
    });
    setItems(grouped);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const counts = useMemo(() => ({
    pendente: auths.filter((a) => a.status === "pendente").length,
    aprovada: auths.filter((a) => a.status === "aprovada").length,
    anomalia: auths.filter((a) => a.cnpj_match === false).length,
    historico: auths.filter((a) => ["utilizada", "recusada", "expirada", "cancelada"].includes(a.status)).length,
  }), [auths]);

  const filtered = useMemo(() => {
    if (tab === "anomalia") return auths.filter((a) => a.cnpj_match === false);
    if (tab === "historico") return auths.filter((a) => ["utilizada", "recusada", "expirada", "cancelada"].includes(a.status));
    return auths.filter((a) => a.status === tab);
  }, [auths, tab]);

  const approve = async (a: AuthRow) => {
    if (!user) return;
    setBusy(a.id);
    const { error } = await supabase
      .from("fuel_authorizations")
      .update({ status: "aprovada", approved_by: user.id })
      .eq("id", a.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Solicitação aprovada — código gerado.");
    setDetail(null);
    load();
  };

  const reject = async () => {
    if (!user || !detail) return;
    setBusy(detail.id);
    const { error } = await supabase
      .from("fuel_authorizations")
      .update({
        status: "recusada",
        approved_by: user.id,
        notes: rejectReason ? `[RECUSA] ${rejectReason}` : detail.notes,
      })
      .eq("id", detail.id);
    setBusy(null);
    setShowReject(false);
    setRejectReason("");
    if (error) return toast.error(error.message);
    toast.success("Solicitação recusada.");
    setDetail(null);
    load();
  };

  const removeAuth = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("fuel_authorizations").delete().eq("id", id);
    setBusy(null);
    setConfirmDeleteId(null);
    if (error) return toast.error(error.message);
    toast.success("Solicitação excluída.");
    setDetail(null);
    load();
  };

  // Permissões de exclusão e visualização por aba
  const canDelete = can("approvals", "delete", tab);
  const canViewTab = (t: string) => can("approvals", "view", t);
  const visibleTabs = ["pendente", "aprovada", "anomalia", "historico"].filter(canViewTab);

  // Se a aba atual não está visível, troca para a primeira visível
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(tab)) {
      setTab(visibleTabs[0]);
    }
  }, [visibleTabs.join(","), tab]);

  if (!isManager) {
    return (
      <div className="surface-card rounded-xl p-10 text-center">
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Você não tem permissão para aprovar solicitações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Aprovações
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Solicitações de abastecimento dos motoristas</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canViewTab("pendente") && (
            <TabsTrigger value="pendente" className="gap-2">
              Pendentes
              {counts.pendente > 0 && <Badge className="bg-warning/20 text-warning border-warning/40">{counts.pendente}</Badge>}
            </TabsTrigger>
          )}
          {canViewTab("aprovada") && (
            <TabsTrigger value="aprovada" className="gap-2">
              Aprovadas
              {counts.aprovada > 0 && <Badge className="bg-success/20 text-success border-success/40">{counts.aprovada}</Badge>}
            </TabsTrigger>
          )}
          {canViewTab("anomalia") && (
            <TabsTrigger value="anomalia" className="gap-2">
              Anomalias
              {counts.anomalia > 0 && <Badge className="bg-destructive/20 text-destructive border-destructive/40">{counts.anomalia}</Badge>}
            </TabsTrigger>
          )}
          {canViewTab("historico") && <TabsTrigger value="historico">Histórico</TabsTrigger>}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="surface-card rounded-xl p-10 text-center">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação nesta aba.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => {
                const v = vehicles[a.vehicle_id];
                const d = a.driver_id ? drivers[a.driver_id] : null;
                const s = a.fuel_station_id ? stations[a.fuel_station_id] : null;
                const requester = profiles[a.requested_by];
                const anomaly = a.cnpj_match === false;
                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setDetail(a)}
                    className={`surface-card rounded-xl p-4 text-left space-y-3 transition hover:border-primary/40 ${anomaly ? "border-destructive/40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-mono font-semibold text-primary">{v?.plate ?? "—"}</span>
                          <span className="text-xs text-muted-foreground truncate">{v?.brand} {v?.model}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(a.requested_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <Badge className={`capitalize border text-[10px] ${STATUS_TONE[a.status]}`}>{a.status}</Badge>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" />
                        {d?.full_name ?? requester?.full_name ?? "—"}
                        {d?.auto_fuel_authorized && (
                          <Badge className="bg-success/15 text-success border-success/30 text-[9px] ml-1">auto</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-muted-foreground" />
                        {s?.name ?? a.station_name ?? "—"}{s?.city ? ` · ${s.city}` : ""}
                      </div>
                      <div className="flex items-center gap-1.5"><Gauge className="h-3 w-3 text-muted-foreground" />
                        KM: {a.km_at_request?.toLocaleString("pt-BR") ?? "—"}
                      </div>
                      {(a.estimated_liters || a.estimated_value) && (
                        <div className="flex items-center gap-1.5"><Fuel className="h-3 w-3 text-muted-foreground" />
                          {a.estimated_liters ? `${a.estimated_liters} L` : ""}
                          {a.estimated_value ? ` · R$ ${Number(a.estimated_value).toFixed(2)}` : ""}
                        </div>
                      )}
                    </div>

                    {anomaly && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/40 p-2 text-[11px] flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        <span>CNPJ do cupom não confere com o posto.</span>
                      </div>
                    )}

                    {a.status === "aprovada" && a.authorization_code && (
                      <div className="font-mono text-center text-base font-bold text-success tracking-widest bg-success/5 rounded-md py-1.5 border border-success/20">
                        {a.authorization_code}
                      </div>
                    )}

                    {canDelete && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(a.id); }}
                          className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Excluir
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detalhes */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (() => {
            const v = vehicles[detail.vehicle_id];
            const d = detail.driver_id ? drivers[detail.driver_id] : null;
            const s = detail.fuel_station_id ? stations[detail.fuel_station_id] : null;
            const requester = profiles[detail.requested_by];
            const its = items[detail.id] ?? [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Solicitação · <span className="font-mono text-primary">{v?.plate}</span>
                    <Badge className={`capitalize border ml-2 ${STATUS_TONE[detail.status]}`}>{detail.status}</Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Veículo</span><div>{v?.plate} · {v?.brand} {v?.model}</div></div>
                    <div><span className="text-muted-foreground text-xs">Motorista</span><div>{d?.full_name ?? requester?.full_name ?? "—"}</div></div>
                    <div><span className="text-muted-foreground text-xs">Posto</span><div>{s?.name ?? detail.station_name ?? "—"}</div></div>
                    <div><span className="text-muted-foreground text-xs">CNPJ posto</span><div className="font-mono text-xs">{s?.cnpj ?? "—"}</div></div>
                    <div><span className="text-muted-foreground text-xs">KM lido</span><div>{detail.km_at_request?.toLocaleString("pt-BR") ?? "—"}</div></div>
                    <div><span className="text-muted-foreground text-xs">KM último registro</span><div>{v?.current_km?.toLocaleString("pt-BR") ?? "—"}</div></div>
                    <div><span className="text-muted-foreground text-xs">Solicitado em</span><div>{new Date(detail.requested_at).toLocaleString("pt-BR")}</div></div>
                    <div><span className="text-muted-foreground text-xs">Expira em</span><div>{detail.expires_at ? new Date(detail.expires_at).toLocaleString("pt-BR") : "—"}</div></div>
                  </div>

                  {/* Fotos */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Hodômetro", url: detail.km_photo_url, icon: Gauge },
                      { label: "Placa", url: detail.plate_photo_url, icon: Truck },
                      { label: "Cupom", url: detail.receipt_photo_url, icon: Receipt },
                    ].map((p) => (
                      <a key={p.label} href={p.url ?? "#"} target="_blank" rel="noreferrer"
                        className={`rounded-md border border-border overflow-hidden aspect-square grid place-items-center bg-muted/30 ${p.url ? "hover:border-primary cursor-pointer" : "opacity-50 pointer-events-none"}`}>
                        {p.url ? (
                          <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-muted-foreground text-[10px]">
                            <p.icon className="h-5 w-5 mx-auto mb-1" />{p.label}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>

                  {/* Anomalia CNPJ */}
                  {detail.cnpj_match === false && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-destructive">
                        <AlertTriangle className="h-4 w-4" /> CNPJ do cupom diverge do posto
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div>Posto: {s?.cnpj ?? "—"}</div>
                        <div>Cupom: {detail.receipt_cnpj ?? "—"}</div>
                      </div>
                    </div>
                  )}

                  {/* Itens do cupom */}
                  {its.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                        <FileCheck className="h-3.5 w-3.5" /> Itens do cupom
                      </div>
                      <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 text-muted-foreground">
                            <tr><th className="text-left p-2">Item</th><th className="text-right p-2">Qtd</th><th className="text-right p-2">Unit.</th><th className="text-right p-2">Total</th></tr>
                          </thead>
                          <tbody>
                            {its.map((i) => (
                              <tr key={i.id} className="border-t border-border">
                                <td className="p-2">{i.description} {i.is_fuel && <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px] ml-1">combustível</Badge>}</td>
                                <td className="p-2 text-right">{Number(i.quantity).toFixed(2)}</td>
                                <td className="p-2 text-right">R$ {Number(i.unit_value).toFixed(2)}</td>
                                <td className="p-2 text-right font-semibold">R$ {Number(i.total_value).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-border bg-muted/20">
                              <td className="p-2 font-semibold" colSpan={3}>Total cupom</td>
                              <td className="p-2 text-right font-semibold">R$ {Number(detail.receipt_total ?? 0).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {detail.notes && (
                    <div className="rounded-md bg-muted/20 border border-border p-2 text-xs whitespace-pre-wrap">
                      {detail.notes}
                    </div>
                  )}

                  {detail.status === "aprovada" && detail.authorization_code && (
                    <div className="font-mono text-center text-2xl font-bold text-success tracking-widest bg-success/10 rounded-md py-3 border border-success/30">
                      {detail.authorization_code}
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  {detail.status === "pendente" && (
                    <>
                      <Button variant="outline" onClick={() => setShowReject(true)} className="text-destructive">
                        <XCircle className="h-4 w-4 mr-2" /> Recusar
                      </Button>
                      <Button onClick={() => approve(detail)} disabled={busy === detail.id}
                        className="bg-gradient-primary text-primary-foreground">
                        {busy === detail.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Aprovar
                      </Button>
                    </>
                  )}
                  {detail.status !== "pendente" && (
                    <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => setConfirmDeleteId(detail.id)}
                      disabled={busy === detail.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Recusa */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar solicitação</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo da recusa (opcional)..." value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject} disabled={busy === detail?.id}>
              {busy === detail?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir solicitação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação remove permanentemente a solicitação de abastecimento e seus itens.
            Não é possível desfazer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && removeAuth(confirmDeleteId)} disabled={busy === confirmDeleteId}>
              {busy === confirmDeleteId && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}