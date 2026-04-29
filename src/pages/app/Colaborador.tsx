import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Sparkles, Camera, Upload, Receipt, ShieldCheck, Clock, Truck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { extractDocument } from "@/lib/ai-extract";

interface Auth {
  id: string; status: string; authorization_code: string | null;
  vehicle_id: string; estimated_liters: number | null; estimated_value: number | null;
  fuel_type: string | null; station_name: string | null;
  requested_at: string; approved_at: string | null; expires_at: string | null;
}

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-warning/20 text-warning border-warning/30",
  aprovada: "bg-success/20 text-success border-success/30",
  recusada: "bg-destructive/20 text-destructive border-destructive/30",
  utilizada: "bg-primary/20 text-primary border-primary/30",
  expirada: "bg-muted text-muted-foreground",
  cancelada: "bg-muted text-muted-foreground",
};

export default function Colaborador() {
  const { currentCompanyId, user, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [auths, setAuths] = useState<Auth[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("solicitar");

  // Form
  const [vehicleId, setVehicleId] = useState("");
  const [estLiters, setEstLiters] = useState("");
  const [estValue, setEstValue] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [station, setStation] = useState("");

  // Confirm fueling state (per auth id)
  const [confirming, setConfirming] = useState<string | null>(null);
  const [plateBusy, setPlateBusy] = useState(false);
  const [kmBusy, setKmBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [confirmData, setConfirmData] = useState<{ plate?: string; km?: number; receiptUrl?: string }>({});

  const load = async () => {
    if (!currentCompanyId || !user) return;
    setLoading(true);
    const [{ data: v }, { data: a }] = await Promise.all([
      supabase.from("vehicles").select("id,plate,brand,model,fuel_type,current_km").eq("company_id", currentCompanyId).order("plate"),
      supabase.from("fuel_authorizations").select("*").eq("company_id", currentCompanyId).eq("requested_by", user.id).order("requested_at", { ascending: false }).limit(30),
    ]);
    setVehicles(v ?? []);
    setAuths((a ?? []) as Auth[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId, user?.id]);

  const submit = async () => {
    if (!currentCompanyId || !user) return;
    if (!vehicleId) return toast.error("Selecione o veículo");
    setBusy(true);
    const { error } = await supabase.from("fuel_authorizations").insert({
      company_id: currentCompanyId,
      vehicle_id: vehicleId,
      requested_by: user.id,
      estimated_liters: estLiters ? Number(estLiters) : null,
      estimated_value: estValue ? Number(estValue) : null,
      fuel_type: fuelType || null,
      station_name: station || null,
      status: "pendente",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada. Aguarde a aprovação do gestor.");
    setVehicleId(""); setEstLiters(""); setEstValue(""); setFuelType(""); setStation("");
    setTab("minhas");
    load();
  };

  const normalizePlate = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const onPlatePhoto = async (file: File) => {
    if (!currentCompanyId) return;
    setPlateBusy(true);
    try {
      const { data } = await extractDocument({ type: "plate", file });
      const plate = data?.plate ? normalizePlate(String(data.plate)) : null;
      if (!plate) throw new Error("IA não identificou a placa");
      setConfirmData((d) => ({ ...d, plate }));
      toast.success(`Placa identificada: ${plate}`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setPlateBusy(false); }
  };

  const onOdometerPhoto = async (file: File) => {
    setKmBusy(true);
    try {
      const { data } = await extractDocument({ type: "odometer", file });
      const km = data?.km ? Number(data.km) : null;
      if (!km) throw new Error("IA não leu o KM");
      setConfirmData((d) => ({ ...d, km }));
      toast.success(`KM identificado: ${km.toLocaleString("pt-BR")}`);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setKmBusy(false); }
  };

  const onReceiptPhoto = async (file: File, authId: string) => {
    if (!user) return;
    setReceiptBusy(true);
    try {
      const path = `${user.id}/receipt/${authId}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("driver-uploads").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setConfirmData((d) => ({ ...d, receiptUrl: path }));
      toast.success("Cupom anexado");
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setReceiptBusy(false); }
  };

  const finalizeFueling = async (auth: Auth) => {
    if (!confirmData.plate || !confirmData.km || !confirmData.receiptUrl) {
      return toast.error("Anexe placa, KM e cupom fiscal");
    }
    const veh = vehicles.find((v) => v.id === auth.vehicle_id);
    if (veh && normalizePlate(veh.plate) !== confirmData.plate) {
      return toast.error(`Placa da foto (${confirmData.plate}) não corresponde ao veículo autorizado (${veh.plate})`);
    }
    setBusy(true);
    const { error } = await supabase.from("fuel_authorizations").update({
      status: "utilizada",
      used_at: new Date().toISOString(),
      notes: `KM final: ${confirmData.km}; Cupom: ${confirmData.receiptUrl}`,
    }).eq("id", auth.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Abastecimento confirmado. O gestor vai validar e registrar.");
    setConfirming(null); setConfirmData({});
    load();
  };

  const pendentesAprovacao = useMemo(() => auths.filter((a) => a.status === "pendente"), [auths]);
  const aprovadasAtivas = useMemo(() => auths.filter((a) => a.status === "aprovada"), [auths]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Área do Colaborador
          </h1>
          <p className="text-sm text-muted-foreground">Solicite abastecimentos e envie comprovantes</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="solicitar" className="flex-1"><Plus className="h-4 w-4 mr-2" />Nova solicitação</TabsTrigger>
          <TabsTrigger value="minhas" className="flex-1">
            Minhas {pendentesAprovacao.length + aprovadasAtivas.length > 0 && (
              <Badge className="ml-2 bg-warning/30 text-warning">{pendentesAprovacao.length + aprovadasAtivas.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solicitar" className="mt-4">
          <div className="surface-card rounded-xl p-6 space-y-4">
            <h3 className="font-display font-semibold">Solicitar autorização de abastecimento</h3>
            <p className="text-xs text-muted-foreground">
              Após o gestor aprovar, você receberá um <b>código de 6 dígitos</b>. Informe ao posto para anotar no cupom fiscal e, depois, anexe a foto do cupom aqui.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Veículo *</Label>
                <Select value={vehicleId} onValueChange={(v) => {
                  setVehicleId(v);
                  const veh = vehicles.find((x) => x.id === v);
                  if (veh?.fuel_type) setFuelType(veh.fuel_type);
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Combustível</Label>
                <Select value={fuelType} onValueChange={setFuelType}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="etanol">Etanol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="diesel_s10">Diesel S10</SelectItem>
                    <SelectItem value="flex">Flex</SelectItem>
                    <SelectItem value="gnv">GNV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Litros estimados</Label>
                <Input type="number" step="0.01" value={estLiters} onChange={(e) => setEstLiters(e.target.value)} />
              </div>
              <div>
                <Label>Valor estimado (R$)</Label>
                <Input type="number" step="0.01" value={estValue} onChange={(e) => setEstValue(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Posto (opcional)</Label>
                <Input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Nome do posto onde pretende abastecer" />
              </div>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enviar solicitação
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="minhas" className="mt-4 space-y-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Carregando...</div>
          ) : auths.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Você ainda não fez nenhuma solicitação.</p>
            </div>
          ) : (
            auths.map((a) => {
              const veh = vehicles.find((v) => v.id === a.vehicle_id);
              const isConfirming = confirming === a.id;
              return (
                <div key={a.id} className="surface-card rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <span className="font-mono text-primary font-semibold">{veh?.plate ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{veh?.brand} {veh?.model}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {new Date(a.requested_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <Badge className={`capitalize border ${STATUS_TONE[a.status]}`}>{a.status}</Badge>
                  </div>

                  {a.status === "aprovada" && a.authorization_code && (
                    <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-center">
                      <div className="text-xs uppercase tracking-widest text-success/80 mb-1">Código de autorização</div>
                      <div className="font-mono text-3xl font-bold text-success tracking-widest">{a.authorization_code}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Informe ao posto para anotar no cupom fiscal · válido até {a.expires_at ? new Date(a.expires_at).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>
                  )}

                  {a.status === "aprovada" && !isConfirming && (
                    <Button onClick={() => { setConfirming(a.id); setConfirmData({}); }} className="w-full" variant="outline">
                      <Camera className="h-4 w-4 mr-2" /> Já abasteci — confirmar com fotos
                    </Button>
                  )}

                  {isConfirming && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <PhotoStep
                        title="1. Foto da PLACA do veículo"
                        subtitle="A IA vai verificar se confere com o veículo autorizado"
                        busy={plateBusy}
                        done={!!confirmData.plate}
                        doneText={confirmData.plate ? `Placa: ${confirmData.plate}` : ""}
                        onFile={onPlatePhoto}
                      />
                      <PhotoStep
                        title="2. Foto do PAINEL (KM atual)"
                        subtitle="A IA vai extrair a quilometragem"
                        busy={kmBusy}
                        done={!!confirmData.km}
                        doneText={confirmData.km ? `KM: ${confirmData.km.toLocaleString("pt-BR")}` : ""}
                        onFile={onOdometerPhoto}
                      />
                      <PhotoStep
                        title="3. Foto do CUPOM FISCAL"
                        subtitle={`Com o código ${a.authorization_code} anotado pelo posto`}
                        busy={receiptBusy}
                        done={!!confirmData.receiptUrl}
                        doneText={confirmData.receiptUrl ? "Cupom enviado" : ""}
                        onFile={(f) => onReceiptPhoto(f, a.id)}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setConfirming(null); setConfirmData({}); }} className="flex-1">Cancelar</Button>
                        <Button onClick={() => finalizeFueling(a)} disabled={busy || !confirmData.plate || !confirmData.km || !confirmData.receiptUrl} className="flex-1 bg-gradient-primary text-primary-foreground">
                          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar abastecimento
                        </Button>
                      </div>
                    </div>
                  )}

                  {a.estimated_liters || a.estimated_value || a.station_name ? (
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                      {a.estimated_liters && <span>Litros est.: {a.estimated_liters}</span>}
                      {a.estimated_value && <span>Valor est.: R$ {Number(a.estimated_value).toFixed(2)}</span>}
                      {a.station_name && <span>Posto: {a.station_name}</span>}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhotoStep({ title, subtitle, busy, done, doneText, onFile }: {
  title: string; subtitle: string; busy: boolean; done: boolean; doneText: string;
  onFile: (f: File) => void;
}) {
  return (
    <label className={`block rounded-lg border p-3 cursor-pointer transition-colors ${done ? "border-success/40 bg-success/5" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="flex items-center gap-3">
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
         done ? <Sparkles className="h-5 w-5 text-success" /> :
         <Upload className="h-5 w-5 text-muted-foreground" />}
        <div className="flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{done ? doneText : subtitle}</div>
        </div>
      </div>
    </label>
  );
}