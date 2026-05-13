import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, Phone, Mail, Briefcase } from "lucide-react";
import { toast } from "sonner";
import CepInput from "@/components/forms/CepInput";

type Broker = {
  id: string;
  name: string;
  legal_name: string | null;
  document: string | null;
  susep: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  cep: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  active: boolean;
};

const empty: Partial<Broker> = { name: "", active: true };

export default function Brokers() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Broker>>(empty);
  const brokerAddressRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("insurance_brokers")
      .select("*")
      .eq("company_id", currentCompanyId)
      .order("name");
    if (error) toast.error(error.message);
    setItems((data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [currentCompanyId]);

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(b: Broker) { setForm(b); setOpen(true); }

  async function save() {
    if (!currentCompanyId || !form.name?.trim()) {
      toast.error("Nome é obrigatório"); return;
    }
    const payload: any = {
      company_id: currentCompanyId,
      name: form.name?.trim(),
      legal_name: form.legal_name || null,
      document: form.document || null,
      susep: form.susep || null,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      cep: form.cep || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state ? form.state.toUpperCase() : null,
      notes: form.notes || null,
      active: form.active ?? true,
    };
    const res = form.id
      ? await supabase.from("insurance_brokers").update(payload).eq("id", form.id)
      : await supabase.from("insurance_brokers").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Salvo"); setOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este corretor?")) return;
    const { error } = await supabase.from("insurance_brokers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído"); load();
  }

  const filtered = items.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [b.name, b.legal_name, b.document, b.contact_name, b.phone, b.email]
      .join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Corretores de Seguros</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os corretores que intermediam suas apólices de frota.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo corretor</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Corretor</th>
                <th className="text-left px-4 py-3">Documento / SUSEP</th>
                <th className="text-left px-4 py-3">Contato</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum corretor cadastrado.</td></tr>
              )}
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />{b.name}</div>
                    {b.legal_name && <div className="text-xs text-muted-foreground">{b.legal_name}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <div>{b.document || "—"}</div>
                    {b.susep && <div className="text-muted-foreground">SUSEP {b.susep}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {b.contact_name && <div className="font-medium">{b.contact_name}</div>}
                    {b.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{b.phone}</div>}
                    {b.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{b.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={b.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted/30 text-muted-foreground border-border"}>
                      {b.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar corretor" : "Novo corretor"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Razão social</Label>
              <Input value={form.legal_name || ""} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ / CPF</Label>
              <Input value={form.document || ""} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </div>
            <div>
              <Label>SUSEP</Label>
              <Input value={form.susep || ""} onChange={(e) => setForm({ ...form, susep: e.target.value })} />
            </div>
            <div>
              <Label>Contato</Label>
              <Input value={form.contact_name || ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <CepInput
                value={form.cep || ""}
                onChange={(v) => setForm({ ...form, cep: v })}
                nextFieldRef={brokerAddressRef}
                onAddressFound={(a) => setForm((p) => ({ ...p, address: a.street, neighborhood: a.neighborhood, city: a.city, state: a.uf }))}
              />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input ref={brokerAddressRef} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número" />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.neighborhood || ""} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>UF</Label>
                <Input maxLength={2} value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}