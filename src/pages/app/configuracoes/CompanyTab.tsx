import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function CompanyTab({ companyId }: { companyId: string }) {
  const { refreshCompanies } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("companies")
        .select("name, cnpj, logo_url").eq("id", companyId).maybeSingle();
      setName(data?.name ?? "");
      setCnpj(data?.cnpj ?? "");
      setLogoUrl(data?.logo_url ?? "");
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
      <div className="pt-2">
        <Button onClick={save} disabled={saving || !name.trim()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}