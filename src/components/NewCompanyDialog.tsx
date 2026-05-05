import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onClose: () => void; alreadyHasCompany: boolean };

export function NewCompanyDialog({ open, onClose, alreadyHasCompany }: Props) {
  const { user, refreshCompanies, setCurrentCompany } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => { setName(""); setCnpj(""); setEmail(""); setPhone(""); setContactName(""); };

  const submit = async () => {
    if (!name.trim()) return;
    if (!user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("bootstrap_company" as any, {
        _company_name: name.trim(),
        _full_name: "",
      });
      if (error) throw error;
      const newId = data as unknown as string;

      // Salva campos opcionais informados
      const extra: Record<string, any> = {};
      if (cnpj.trim()) extra.cnpj = cnpj.trim();
      if (email.trim()) extra.email = email.trim();
      if (phone.trim()) extra.phone = phone.trim();
      if (contactName.trim()) extra.contact_name = contactName.trim();
      if (Object.keys(extra).length) {
        await supabase.from("companies").update(extra).eq("id", newId);
      }

      await refreshCompanies();
      await setCurrentCompany(newId);
      reset();
      onClose();

      if (alreadyHasCompany) {
        toast.success("Empresa criada! Conclua o pagamento para começar a usar.");
        nav("/app/assinatura");
      } else {
        toast.success("Empresa criada!");
        nav("/app");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar empresa");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Nova empresa
          </DialogTitle>
        </DialogHeader>

        {alreadyHasCompany && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-warning">Esta será sua segunda empresa</div>
              <div className="text-xs text-muted-foreground mt-1">
                Empresas adicionais exigem assinatura paga (a partir de
                <strong className="text-foreground"> R$ 99,90/mês — até 5 veículos</strong>).
                A empresa nasce em modo aguardando pagamento — você poderá usá-la após
                concluir a assinatura.
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome da empresa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Transportadora ABC Ltda"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome do contato" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={creating}>Cancelar</Button>
          <Button onClick={submit} disabled={creating || !name.trim()} className="gap-2 bg-gradient-primary">
            {creating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : alreadyHasCompany
                ? <><CreditCard className="h-4 w-4" /> Criar e ir para assinatura</>
                : <>Criar empresa</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}