import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Search, UserPlus, Trash2, ArrowRight, MessageCircle, Mail, Phone, Plus, X } from "lucide-react";
import { toast } from "sonner";

type Lead = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  cnpj: string | null;
  quantidade_veiculos: string | null;
  maior_dor: string | null;
  origem: "CAL_COM" | "WHATSAPP" | "FORMULARIO_DIRETO" | "INDICACAO" | "OUTRO";
  status: "NOVO" | "CONTATADO" | "DEMO_AGENDADA" | "EM_NEGOCIACAO" | "CONVERTIDO" | "PERDIDO";
  cal_booking_id: string | null;
  converted_company_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTS: Lead["status"][] = ["NOVO", "CONTATADO", "DEMO_AGENDADA", "EM_NEGOCIACAO", "CONVERTIDO", "PERDIDO"];
const ORIGEM_OPTS: Lead["origem"][] = ["CAL_COM", "WHATSAPP", "FORMULARIO_DIRETO", "INDICACAO", "OUTRO"];
const VEICULOS_OPTS = ["1-10", "11-30", "31-100", "Mais de 100"];
type Period = "ALL" | "TODAY" | "7D" | "30D";

const statusColor: Record<Lead["status"], string> = {
  NOVO: "bg-primary/15 text-primary border-primary/40",
  CONTATADO: "bg-warning/15 text-warning border-warning/40",
  DEMO_AGENDADA: "bg-purple-500/15 text-purple-400 border-purple-500/40",
  EM_NEGOCIACAO: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  CONVERTIDO: "bg-success/15 text-success border-success/40",
  PERDIDO: "bg-destructive/15 text-destructive border-destructive/40",
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function LeadsPanel() {
  const nav = useNavigate();
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [origemFilter, setOrigemFilter] = useState<Set<string>>(new Set());
  const [veiculosFilter, setVeiculosFilter] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<Period>("ALL");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data ?? []) as Lead[]);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const since = (() => {
      const now = Date.now();
      if (period === "TODAY") {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
      }
      if (period === "7D") return now - 7 * 86400_000;
      if (period === "30D") return now - 30 * 86400_000;
      return 0;
    })();
    return items.filter((l) => {
      if (statusFilter.size > 0 && !statusFilter.has(l.status)) return false;
      if (origemFilter.size > 0 && !origemFilter.has(l.origem)) return false;
      if (veiculosFilter.size > 0 && !veiculosFilter.has(l.quantidade_veiculos ?? "")) return false;
      if (since && new Date(l.created_at).getTime() < since) return false;
      if (!q) return true;
      return (
        (l.nome ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.empresa ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter, origemFilter, veiculosFilter, period]);

  async function changeStatus(lead: Lead, status: Lead["status"]) {
    const prev = items;
    setItems((arr) => arr.map((x) => (x.id === lead.id ? { ...x, status } : x)));
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    } else {
      toast.success("Status atualizado");
      if (selected?.id === lead.id) setSelected({ ...lead, status });
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase
      .from("leads").update({ notes: notesDraft }).eq("id", selected.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Notas salvas");
    setItems((arr) => arr.map((x) => (x.id === selected.id ? { ...x, notes: notesDraft } : x)));
    setSelected({ ...selected, notes: notesDraft });
  }

  async function remove(lead: Lead) {
    if (!confirm(`Excluir lead ${lead.nome ?? lead.email ?? lead.id}?`)) return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead excluído");
    setItems((arr) => arr.filter((x) => x.id !== lead.id));
    if (selected?.id === lead.id) setSelected(null);
  }

  function convert(lead: Lead) {
    nav(`/super-admin/empresas/nova?leadId=${lead.id}`);
  }

  function openDetail(l: Lead) {
    setSelected(l);
    setNotesDraft(l.notes ?? "");
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Potenciais clientes vindos da landing, Cal.com e WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo lead
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {filtered.length} de {items.length} lead(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou empresa"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <MultiFilter label="Status" options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} />
              <MultiFilter label="Origem" options={ORIGEM_OPTS} value={origemFilter} onChange={setOrigemFilter} />
              <MultiFilter label="Qtd. veículos" options={VEICULOS_OPTS} value={veiculosFilter} onChange={setVeiculosFilter} />
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todo o período</SelectItem>
                  <SelectItem value="TODAY">Hoje</SelectItem>
                  <SelectItem value="7D">Últimos 7 dias</SelectItem>
                  <SelectItem value="30D">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 grid place-items-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Nenhum lead encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Nome</th>
                    <th className="text-left py-2 px-2">Empresa</th>
                    <th className="text-left py-2 px-2 hidden md:table-cell">Contato</th>
                    <th className="text-left py-2 px-2 hidden lg:table-cell">Origem</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2 hidden lg:table-cell">Criado</th>
                    <th className="text-right py-2 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{l.nome ?? "—"}</td>
                      <td className="py-2 px-2">{l.empresa ?? "—"}</td>
                      <td className="py-2 px-2 hidden md:table-cell text-muted-foreground">
                        <div>{l.email ?? "—"}</div>
                        <div className="text-xs">{l.telefone ?? ""}</div>
                      </td>
                      <td className="py-2 px-2 hidden lg:table-cell">
                        <Badge variant="outline" className="text-[10px]">{l.origem}</Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Select value={l.status} onValueChange={(v) => changeStatus(l, v as Lead["status"])}>
                          <SelectTrigger className={`h-7 text-xs ${statusColor[l.status]} border w-[150px]`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 hidden lg:table-cell text-muted-foreground text-xs">{fmt(l.created_at)}</td>
                      <td className="py-2 px-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openDetail(l)}>Ver</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditLead(l)} className="hidden md:inline-flex">
                            Editar
                          </Button>
                          {l.status !== "CONVERTIDO" && (
                            <Button size="sm" variant="outline" onClick={() => convert(l)} className="hidden md:inline-flex">
                              <UserPlus className="h-3.5 w-3.5 mr-1" /> Converter
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove(l)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.nome ?? "Lead"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Info label="Email" value={selected.email} icon={<Mail className="h-3.5 w-3.5" />} />
                  <Info label="Telefone" value={selected.telefone} icon={<Phone className="h-3.5 w-3.5" />} />
                  <Info label="Empresa" value={selected.empresa} />
                  <Info label="CNPJ" value={selected.cnpj} />
                  <Info label="Qtd. veículos" value={selected.quantidade_veiculos} />
                  <Info label="Origem" value={selected.origem} />
                  <Info label="Cal.com booking" value={selected.cal_booking_id} />
                  <Info label="Criado em" value={fmt(selected.created_at)} />
                </div>
                {selected.maior_dor && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Maior dor</Label>
                    <p className="text-sm mt-1 p-3 rounded-md bg-muted/40">{selected.maior_dor}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Notas internas</Label>
                  <Textarea
                    rows={4}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Anote contexto da conversa, próximos passos…"
                    className="mt-1"
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={saveNotes} disabled={busy}>
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Salvar notas
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {selected.telefone && (
                    <a
                      href={`https://wa.me/${selected.telefone.replace(/\D/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {selected.email && (
                    <a href={`mailto:${selected.email}`}>
                      <Button size="sm" variant="outline">
                        <Mail className="h-3.5 w-3.5 mr-1" /> Email
                      </Button>
                    </a>
                  )}
                  {selected.status !== "CONVERTIDO" ? (
                    <Button size="sm" onClick={() => convert(selected)} className="ml-auto">
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Converter em empresa <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  ) : selected.converted_company_id && (
                    <Link to="/super-admin" className="ml-auto">
                      <Button size="sm" variant="outline">Ver empresa</Button>
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <LeadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(lead) => { setItems((arr) => [lead, ...arr]); }}
      />

      <LeadFormDialog
        open={!!editLead}
        editing={editLead}
        onOpenChange={(o) => !o && setEditLead(null)}
        onSaved={(lead) => { setItems((arr) => arr.map((x) => x.id === lead.id ? lead : x)); }}
      />
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="mt-0.5 font-medium">{value || "—"}</div>
    </div>
  );
}

function MultiFilter({
  label, options, value, onChange,
}: { label: string; options: string[]; value: Set<string>; onChange: (s: Set<string>) => void }) {
  const toggle = (o: string) => {
    const n = new Set(value);
    if (n.has(o)) n.delete(o); else n.add(o);
    onChange(n);
  };
  const summary = value.size === 0 ? label : `${label}: ${value.size}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between h-10 w-full font-normal">
          <span className="truncate">{summary}</span>
          {value.size > 0 ? (
            <X
              className="h-3.5 w-3.5 opacity-60 ml-1"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(new Set()); }}
            />
          ) : (
            <span className="text-muted-foreground text-xs">▾</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/50 text-left"
          >
            <Checkbox checked={value.has(o)} className="pointer-events-none" />
            <span>{o}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function LeadFormDialog({
  open, onOpenChange, onSaved, editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (l: Lead) => void;
  editing?: Lead | null;
}) {
  const empty = {
    nome: "", email: "", telefone: "", empresa: "", cnpj: "",
    quantidade_veiculos: "", maior_dor: "",
    origem: "INDICACAO" as Lead["origem"],
    status: "NOVO" as Lead["status"],
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        nome: editing.nome ?? "",
        email: editing.email ?? "",
        telefone: editing.telefone ?? "",
        empresa: editing.empresa ?? "",
        cnpj: editing.cnpj ?? "",
        quantidade_veiculos: editing.quantidade_veiculos ?? "",
        maior_dor: editing.maior_dor ?? "",
        origem: editing.origem,
        status: editing.status,
        notes: editing.notes ?? "",
      });
    } else if (open) {
      setForm(empty);
    }
  }, [editing, open]);

  async function save() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    if (!form.empresa.trim()) { toast.error("Informe a empresa"); return; }
    setSaving(true);
    if (editing) {
      const { data, error } = await supabase
        .from("leads").update(form).eq("id", editing.id).select("*").single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Lead atualizado");
      onSaved(data as Lead);
      onOpenChange(false);
    } else {
      const { data, error } = await supabase
        .from("leads").insert(form).select("*").single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Lead criado");
      onSaved(data as Lead);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div><Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div><Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div><Label>Empresa *</Label>
            <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
          </div>
          <div><Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
          </div>
          <div><Label>Qtd. veículos</Label>
            <Select value={form.quantidade_veiculos} onValueChange={(v) => setForm({ ...form, quantidade_veiculos: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {VEICULOS_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Origem</Label>
            <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v as Lead["origem"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGEM_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Lead["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Maior dor</Label>
            <Textarea rows={2} value={form.maior_dor} onChange={(e) => setForm({ ...form, maior_dor: e.target.value })} />
          </div>
          <div className="md:col-span-2"><Label>Notas internas</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Salvar" : "Criar lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}