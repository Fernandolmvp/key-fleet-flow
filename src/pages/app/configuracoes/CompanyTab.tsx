import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function CompanyTab({ companyId }: { companyId: string }) {
  const { refreshCompanies } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [status, setStatus] = useState<"ativa" | "suspensa" | "cancelada">("ativa");
  const [fuelAuthTtl, setFuelAuthTtl] = useState<number>(30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("companies")
        .select("name, cnpj, logo_url, email, phone, contact_name, address, city, state, status, fuel_auth_code_ttl_minutes")
        .eq("id", companyId).maybeSingle();
      setName(data?.name ?? "");
      setCnpj(data?.cnpj ?? "");
      setLogoUrl(data?.logo_url ?? "");
      setEmail((data as any)?.email ?? "");
      setPhone((data as any)?.phone ?? "");
      setContactName((data as any)?.contact_name ?? "");
      setAddress((data as any)?.address ?? "");
      setCity((data as any)?.city ?? "");
      setState((data as any)?.state ?? "");
      setStatus(((data as any)?.status as any) ?? "ativa");
      setFuelAuthTtl(Number((data as any)?.fuel_auth_code_ttl_minutes ?? 30));
      setLoading(false);
    })();
  }, [companyId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("companies").update({
        name: name.trim(),
        cnpj: cnpj.trim() || null,
        logo_url: logoUrl.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        contact_name: contactName.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        status,
        fuel_auth_code_ttl_minutes: Math.max(5, Math.min(1440, Number(fuelAuthTtl) || 30)),
      }).eq("id", companyId);
      if (error) throw error;
      toast.success("Empresa atualizada");
      await refreshCompanies();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="surface-card rounded-xl p-6 max-w-2xl space-y-4">
      <h3 className="font-display font-semibold">Dados da empresa</h3>
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
        </div>
        <div className="space-y-2">
          <Label>URL do logo</Label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Responsável</Label>
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome do contato" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="suspensa">Suspensa</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Endereço</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estado (UF)</Label>
          <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} placeholder="SP" />
        </div>
      </div>
      <div className="border-t border-border pt-4 space-y-2">
        <h4 className="font-display font-semibold text-sm">Autorização de abastecimento</h4>
        <Label>Validade do código (minutos)</Label>
        <Input
          type="number"
          min={5}
          max={1440}
          value={fuelAuthTtl}
          onChange={(e) => setFuelAuthTtl(Number(e.target.value))}
          className="max-w-[200px]"
        />
        <p className="text-xs text-muted-foreground">
          Tempo que o motorista tem para usar o código de 6 dígitos no posto. Padrão: 30 minutos.
        </p>
      </div>
      <div className="pt-2">
        <Button onClick={save} disabled={saving || !name.trim()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}