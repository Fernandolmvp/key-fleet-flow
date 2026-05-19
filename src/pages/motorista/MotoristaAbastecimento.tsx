import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Fuel, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FUELS, PAYMENTS, fmtMoney } from "@/lib/fuel";
import { toast } from "sonner";
import MotoristaBottomNav from "@/components/motorista/MotoristaBottomNav";

export default function MotoristaAbastecimento() {
  const { user, currentCompanyId } = useAuth();
  const nav = useNavigate();
  const [vehicle, setVehicle] = useState<any>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [form, setForm] = useState({
    km: "", liters: "", total: "", fuel_type: "gasolina", payment_method: "cartao_frota", station_id: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !currentCompanyId) return;
    (async () => {
      const { data: drv } = await supabase.from("drivers")
        .select("id, assigned_vehicle_id").eq("user_id", user.id).eq("company_id", currentCompanyId).maybeSingle();
      if (drv?.assigned_vehicle_id) {
        const { data: v } = await supabase.from("vehicles").select("id, plate, brand, model, current_km, fuel_type")
          .eq("id", drv.assigned_vehicle_id).maybeSingle();
        setVehicle(v);
        if (v?.fuel_type) setForm(f => ({ ...f, fuel_type: v.fuel_type }));
      }
      const { data: st } = await supabase.from("fuel_stations").select("id, name, city").eq("company_id", currentCompanyId).eq("active", true).order("name");
      setStations(st ?? []); setLoading(false);
    })();
  }, [user, currentCompanyId]);

  const liters = parseFloat(form.liters || "0");
  const total = parseFloat(form.total || "0");
  const pricePerLiter = liters > 0 ? total / liters : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle) return toast.error("Sem veículo atribuído");
    setBusy(true);
    try {
      const km = parseInt(form.km, 10);
      if (!km || km < (vehicle.current_km ?? 0)) throw new Error("KM precisa ser maior que o último registrado");
      let receiptUrl: string | null = null;
      if (photo) {
        const path = `${currentCompanyId}/${vehicle.id}/${Date.now()}-${photo.name.replace(/\s+/g,'_')}`;
        const up = await supabase.storage.from("fuel-receipts").upload(path, photo, { upsert: false });
        if (!up.error) receiptUrl = up.data.path;
      }
      const { error } = await supabase.from("fuel_records").insert([{
        company_id: currentCompanyId,
        vehicle_id: vehicle.id,
        fuel_type: form.fuel_type,
        liters, total_value: total, price_per_liter: Number(pricePerLiter.toFixed(3)),
        km_at_fueling: km,
        payment_method: form.payment_method,
        fuel_station_id: form.station_id || null,
        receipt_url: receiptUrl,
        source_origin: "motorista",
      } as any]);
      if (error) throw error;
      toast.success("Abastecimento registrado");
      nav("/motorista");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/motorista"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-semibold flex-1">Registrar abastecimento</h1>
      </header>
      <form onSubmit={submit} className="px-4 py-4 space-y-4 max-w-md mx-auto">
        {vehicle ? (
          <div className="surface-card rounded-xl p-4 text-sm">
            <div className="font-semibold">{vehicle.plate}</div>
            <div className="text-muted-foreground">{vehicle.brand} {vehicle.model} · KM atual: {vehicle.current_km ?? 0}</div>
          </div>
        ) : <div className="text-sm text-warning">Nenhum veículo atribuído.</div>}

        <div><Label>KM atual *</Label>
          <Input type="number" inputMode="numeric" required value={form.km}
            onChange={e => setForm(f => ({ ...f, km: e.target.value }))} className="h-12 text-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Litros *</Label>
            <Input type="number" step="0.01" required value={form.liters}
              onChange={e => setForm(f => ({ ...f, liters: e.target.value }))} className="h-12 text-lg" />
          </div>
          <div><Label>Total R$ *</Label>
            <Input type="number" step="0.01" required value={form.total}
              onChange={e => setForm(f => ({ ...f, total: e.target.value }))} className="h-12 text-lg" />
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          R$/litro: <span className="font-semibold">{pricePerLiter > 0 ? fmtMoney(pricePerLiter) : "—"}</span>
        </div>
        <div><Label>Combustível</Label>
          <Select value={form.fuel_type} onValueChange={v => setForm(f => ({ ...f, fuel_type: v }))}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>{FUELS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Forma de pagamento</Label>
          <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>{PAYMENTS.map(p => <SelectItem key={p} value={p}>{p.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Posto</Label>
          <Select value={form.station_id} onValueChange={v => setForm(f => ({ ...f, station_id: v }))}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{stations.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.city ? `· ${s.city}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Foto do cupom</Label>
          <Input type="file" accept="image/*" capture="environment"
            onChange={e => setPhoto(e.target.files?.[0] ?? null)} className="h-12" />
        </div>
        <Button type="submit" disabled={busy || !vehicle} className="w-full h-14 text-base bg-gradient-primary text-primary-foreground gap-2">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fuel className="h-5 w-5" />} Registrar
        </Button>
      </form>
      <MotoristaBottomNav />
    </div>
  );
}