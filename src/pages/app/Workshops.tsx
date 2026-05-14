import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Wrench, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CepInput from "@/components/forms/CepInput";
import CnpjLookupInput, { type CnpjLookupResult } from "@/components/forms/CnpjLookupInput";
import { WORKSHOP_TYPES, PAYMENT_TERMS, PIX_KEY_TYPES, INVOICE_TYPES_SERVICE, PARTNER_STATUS, labelOf } from "@/lib/partners";
import { onlyDigits, isValidDocument } from "@/lib/document";

const blank = () => ({
  id: "",
  name: "",
  trade_name: "",
  document_type: "cnpj" as "cnpj" | "cpf",
  document_number: "",
  state_registration: "",
  municipal_registration: "",
  workshop_type: [] as string[],
  specialties: "" as string,
  contact_name: "", contact_role: "", phone: "", whatsapp: "", email: "", website: "",
  zip_code: "", street: "", address_number: "", address_complement: "",
  neighborhood: "", city: "", state: "",
  payment_terms: "", pix_key: "", pix_key_type: "",
  bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "corrente",
  pis: "", cofins: "", iss_rate: "", icms_rate: "",
  issues_invoice: false, invoice_type: "", cnae_code: "", simples_nacional: false,
  contract_start: "", contract_end: "",
  preferred: false, credit_limit: "", discount_pct: "0", warranty_days: "90",
  notes: "", tags: "", status: "active",
  cnpj_verified: false,
});

export default function Workshops() {
  const { currentCompanyId, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(blank());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentCompanyId) return;
    const { data, error } = await supabase.from("workshops").select("*")
      .eq("company_id", currentCompanyId).order("name");
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [currentCompanyId]);

  const openNew = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (w: any) => {
    setEditing(w);
    setForm({
      ...blank(), ...w,
      workshop_type: w.workshop_type ?? [],
      specialties: (w.specialties ?? []).join(", "),
      tags: (w.tags ?? []).join(", "),
      iss_rate: w.iss_rate?.toString() ?? "",
      icms_rate: w.icms_rate?.toString() ?? "",
      credit_limit: w.credit_limit?.toString() ?? "",
      discount_pct: w.discount_pct?.toString() ?? "0",
      warranty_days: w.warranty_days?.toString() ?? "90",
    });
    setOpen(true);
  };

  const onCnpjLookup = (r: CnpjLookupResult) => {
    setForm((f: any) => ({
      ...f,
      name: f.name || r.legalName || "",
      trade_name: f.trade_name || r.tradeName || "",
      email: f.email || r.email || "",
      phone: f.phone || r.phone || "",
      zip_code: f.zip_code || r.zipCode || "",
      street: f.street || r.street || "",
      address_number: f.address_number || r.number || "",
      address_complement: f.address_complement || r.complement || "",
      neighborhood: f.neighborhood || r.neighborhood || "",
      city: f.city || r.city || "",
      state: f.state || r.state || "",
      cnae_code: f.cnae_code || r.cnaeCode || "",
      cnpj_verified: true,
    }));
  };

  const toggleType = (v: string) =>
    setForm((f: any) => ({
      ...f,
      workshop_type: f.workshop_type.includes(v) ? f.workshop_type.filter((x: string) => x !== v) : [...f.workshop_type, v],
    }));

  const save = async () => {
    if (!currentCompanyId) return;
    if (!form.name?.trim()) return toast.error("Nome é obrigatório");
    if (form.document_number && !isValidDocument(form.document_number, form.document_type)) {
      return toast.error("Documento inválido");
    }
    setBusy(true);
    const payload: any = {
      ...form,
      company_id: currentCompanyId,
      document_number: form.document_number ? onlyDigits(form.document_number) : null,
      specialties: form.specialties ? form.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      iss_rate: form.iss_rate ? Number(form.iss_rate) : null,
      icms_rate: form.icms_rate ? Number(form.icms_rate) : null,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
      discount_pct: form.discount_pct ? Number(form.discount_pct) : 0,
      warranty_days: form.warranty_days ? Number(form.warranty_days) : 90,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      state: form.state ? form.state.toUpperCase() : null,
      updated_by: user?.id ?? null,
    };
    if (!editing) payload.created_by = user?.id ?? null;
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const op = editing
      ? supabase.from("workshops").update(payload).eq("id", editing.id)
      : supabase.from("workshops").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Oficina atualizada" : "Oficina cadastrada");
    setOpen(false); load();
  };

  const remove = async (w: any) => {
    if (!confirm(`Excluir oficina "${w.name}"?`)) return;
    const { error } = await supabase.from("workshops").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success("Oficina excluída"); load();
  };

  const filtered = items.filter((w) => {
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return (w.name + " " + (w.trade_name ?? "") + " " + (w.document_number ?? "") + " " + (w.city ?? "")).toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Oficinas / Mecânicas</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro completo, preparado para futura emissão de notas fiscais</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Nova oficina
        </Button>
      </div>

      <div className="surface-card rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ, cidade..." value={q} onChange={(e) => setQ(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {PARTNER_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma oficina cadastrada.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => {
            const tone = PARTNER_STATUS.find((s) => s.value === w.status)?.tone ?? "";
            return (
              <div key={w.id} className="surface-card rounded-xl p-5 space-y-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-semibold truncate flex items-center gap-1.5">
                      {w.name}
                      {w.preferred && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                    </div>
                    {w.trade_name && <div className="text-xs text-muted-foreground">{w.trade_name}</div>}
                  </div>
                  <Badge className={`border ${tone}`}>{labelOf(PARTNER_STATUS, w.status)}</Badge>
                </div>
                {w.document_number && <div className="font-mono text-xs text-muted-foreground">{w.document_number}</div>}
                {(w.city || w.state) && <div className="text-xs text-muted-foreground">{[w.city, w.state].filter(Boolean).join(" / ")}</div>}
                {w.workshop_type?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {w.workshop_type.slice(0, 4).map((t: string) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{labelOf(WORKSHOP_TYPES, t)}</span>
                    ))}
                    {w.workshop_type.length > 4 && <span className="text-[10px] text-muted-foreground">+{w.workshop_type.length - 4}</span>}
                  </div>
                )}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(w)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(w)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar oficina" : "Nova oficina"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="ident">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="ident">Identificação</TabsTrigger>
              <TabsTrigger value="contact">Contato</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
              <TabsTrigger value="commercial">Comercial</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
              <TabsTrigger value="contract">Contrato</TabsTrigger>
            </TabsList>

            <TabsContent value="ident" className="space-y-4 mt-4">
              <CnpjLookupInput
                documentType={form.document_type}
                onDocumentTypeChange={(t) => setForm({ ...form, document_type: t })}
                value={form.document_number}
                onChange={(v) => setForm({ ...form, document_number: v, cnpj_verified: false })}
                onLookup={onCnpjLookup}
                verified={form.cnpj_verified}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Razão social *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Nome fantasia</Label>
                  <Input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Inscrição estadual</Label>
                  <Input value={form.state_registration} onChange={(e) => setForm({ ...form, state_registration: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Inscrição municipal</Label>
                  <Input value={form.municipal_registration} onChange={(e) => setForm({ ...form, municipal_registration: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipos de serviço</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WORKSHOP_TYPES.map((t) => {
                    const on = form.workshop_type.includes(t.value);
                    return (
                      <button key={t.value} type="button" onClick={() => toggleType(t.value)}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${on ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30"}`}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2"><Label>Especialidades / marcas atendidas</Label>
                <Input placeholder="Ex.: VW, Mercedes, Volvo" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} />
                <p className="text-xs text-muted-foreground">Separe por vírgula</p>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Pessoa de contato</Label>
                  <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Cargo</Label>
                  <Input value={form.contact_role} onChange={(e) => setForm({ ...form, contact_role: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Site</Label>
                  <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <CepInput
                  value={form.zip_code || ""}
                  onChange={(v) => setForm({ ...form, zip_code: v })}
                  onAddressFound={(a) => setForm((p: any) => ({ ...p, street: a.street, neighborhood: a.neighborhood, city: a.city, state: a.uf }))}
                />
                <div className="space-y-2"><Label>Logradouro</Label>
                  <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Número</Label>
                  <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Complemento</Label>
                  <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>UF</Label>
                  <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="commercial" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Condições de pagamento</Label>
                  <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{PAYMENT_TERMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Desconto negociado (%)</Label>
                  <Input type="number" step="0.01" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Limite de crédito (R$)</Label>
                  <Input type="number" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Garantia padrão (dias)</Label>
                  <Input type="number" value={form.warranty_days} onChange={(e) => setForm({ ...form, warranty_days: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Tipo de chave PIX</Label>
                  <Select value={form.pix_key_type} onValueChange={(v) => setForm({ ...form, pix_key_type: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{PIX_KEY_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Chave PIX</Label>
                  <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Banco</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>Agência</Label>
                    <Input value={form.bank_agency} onChange={(e) => setForm({ ...form, bank_agency: e.target.value })} />
                  </div>
                  <div className="space-y-2"><Label>Conta</Label>
                    <Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2"><Label>Tipo de conta</Label>
                  <Select value={form.bank_account_type} onValueChange={(v) => setForm({ ...form, bank_account_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <Switch checked={form.issues_invoice} onCheckedChange={(v) => setForm({ ...form, issues_invoice: v })} />
                <Label>Emite nota fiscal</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.simples_nacional} onCheckedChange={(v) => setForm({ ...form, simples_nacional: v })} />
                <Label>Optante pelo Simples Nacional</Label>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tipo de NF</Label>
                  <Select value={form.invoice_type} onValueChange={(v) => setForm({ ...form, invoice_type: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{INVOICE_TYPES_SERVICE.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>CNAE</Label>
                  <Input value={form.cnae_code} onChange={(e) => setForm({ ...form, cnae_code: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>ISS (%)</Label>
                  <Input type="number" step="0.01" value={form.iss_rate} onChange={(e) => setForm({ ...form, iss_rate: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>ICMS (%)</Label>
                  <Input type="number" step="0.01" value={form.icms_rate} onChange={(e) => setForm({ ...form, icms_rate: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>PIS</Label>
                  <Input value={form.pis} onChange={(e) => setForm({ ...form, pis: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>COFINS</Label>
                  <Input value={form.cofins} onChange={(e) => setForm({ ...form, cofins: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contract" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Início do contrato</Label>
                  <Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Fim do contrato</Label>
                  <Input type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PARTNER_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Switch checked={form.preferred} onCheckedChange={(v) => setForm({ ...form, preferred: v })} />
                  <Label>Fornecedor preferencial</Label>
                </div>
              </div>
              <div className="space-y-2"><Label>Tags</Label>
                <Input placeholder="Ex.: confiável, rápido, perto" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                <p className="text-xs text-muted-foreground">Separe por vírgula</p>
              </div>
              <div className="space-y-2"><Label>Observações internas</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}