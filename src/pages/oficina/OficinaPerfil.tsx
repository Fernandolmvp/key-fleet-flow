import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";

const SPECS = ["motor","suspensao","freios","eletrica","ar_condicionado","lataria","pintura","alinhamento_balanceamento","escapamento","transmissao"];
const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Segunda" }, { key: "tue", label: "Terça" }, { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" }, { key: "fri", label: "Sexta" }, { key: "sat", label: "Sábado" }, { key: "sun", label: "Domingo" },
];

export default function OficinaPerfil() {
  const { token } = useWorkshopAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);

  async function call(path: string, body?: any) {
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText); return j;
  }

  useEffect(() => {
    (async () => {
      try {
        const j = await call("workshop-profile");
        const wp = j.workshop;
        wp.operating_hours = wp.operating_hours ?? {};
        wp.specialties = wp.specialties ?? [];
        setData(wp);
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));
  const setHours = (day: string, key: string, v: any) =>
    setData((d: any) => ({ ...d, operating_hours: { ...d.operating_hours, [day]: { ...(d.operating_hours[day] ?? {}), [key]: v } } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await call("workshop-profile", { update: {
        name: data.name, trade_name: data.trade_name, document_number: data.document_number,
        phone: data.phone, whatsapp: data.whatsapp, email: data.email,
        zip_code: data.zip_code, street: data.street, address_number: data.address_number,
        neighborhood: data.neighborhood, city: data.city, state: data.state,
        specialties: data.specialties, operating_hours: data.operating_hours,
      }});
      toast.success("Perfil atualizado");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="p-4">Erro ao carregar.</div>;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      <section className="surface-card rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Dados da oficina</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Razão social</Label><Input value={data.name ?? ""} onChange={e => set("name", e.target.value)} required /></div>
          <div><Label>Nome fantasia</Label><Input value={data.trade_name ?? ""} onChange={e => set("trade_name", e.target.value)} /></div>
          <div><Label>CNPJ</Label><Input value={data.document_number ?? ""} onChange={e => set("document_number", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={data.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={data.phone ?? ""} onChange={e => set("phone", e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={data.whatsapp ?? ""} onChange={e => set("whatsapp", e.target.value)} /></div>
        </div>
      </section>
      <section className="surface-card rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Endereço</h2>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2"><Label>CEP</Label><Input value={data.zip_code ?? ""} onChange={e => set("zip_code", e.target.value)} /></div>
          <div className="col-span-4"><Label>Rua</Label><Input value={data.street ?? ""} onChange={e => set("street", e.target.value)} /></div>
          <div className="col-span-2"><Label>Número</Label><Input value={data.address_number ?? ""} onChange={e => set("address_number", e.target.value)} /></div>
          <div className="col-span-4"><Label>Bairro</Label><Input value={data.neighborhood ?? ""} onChange={e => set("neighborhood", e.target.value)} /></div>
          <div className="col-span-4"><Label>Cidade</Label><Input value={data.city ?? ""} onChange={e => set("city", e.target.value)} /></div>
          <div className="col-span-2"><Label>UF</Label><Input maxLength={2} value={data.state ?? ""} onChange={e => set("state", e.target.value.toUpperCase())} /></div>
        </div>
      </section>
      <section className="surface-card rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Especialidades</h2>
        <div className="grid grid-cols-3 gap-2">
          {SPECS.map(s => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox checked={data.specialties.includes(s)} onCheckedChange={(c) => {
                set("specialties", c ? [...data.specialties, s] : data.specialties.filter((x: string) => x !== s));
              }} />
              {s.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </section>
      <section className="surface-card rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Horário de funcionamento</h2>
        <div className="space-y-2">
          {DAYS.map(d => {
            const h = data.operating_hours[d.key] ?? { closed: false, open: "08:00", close: "18:00" };
            return (
              <div key={d.key} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2 text-sm">{d.label}</div>
                <div className="col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox checked={!!h.closed} onCheckedChange={c => setHours(d.key, "closed", !!c)} /> Fechado
                </div>
                <Input type="time" disabled={h.closed} value={h.open ?? ""} onChange={e => setHours(d.key, "open", e.target.value)} className="col-span-3" />
                <Input type="time" disabled={h.closed} value={h.close ?? ""} onChange={e => setHours(d.key, "close", e.target.value)} className="col-span-3" />
              </div>
            );
          })}
        </div>
      </section>
      <Button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </Button>
    </form>
  );
}