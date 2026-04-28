import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Users, Pencil, Trash2, Loader2, Upload, AlertTriangle, Sparkles, FileText } from "lucide-react";
import { extractDocument } from "@/lib/ai-extract";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Driver {
  id: string; full_name: string; cpf: string | null; phone: string | null;
  cnh_number: string | null; cnh_category: string | null; cnh_expires_at: string | null;
  medical_exam_expires_at: string | null; status: string; photo_url: string | null;
}

const STATUSES = ["ativo","inativo","ferias","afastado"];

export default function Drivers() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<Driver[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [archivedDoc, setArchivedDoc] = useState<string | null>(null);
  const [form, setForm] = useState<any>(blank());

  function blank() {
    return { full_name: "", cpf: "", phone: "", email: "", cnh_number: "", cnh_category: "", cnh_expires_at: "", medical_exam_expires_at: "", address: "", status: "ativo", photo_url: "" };
  }

  const load = async () => {
    if (!currentCompanyId) return;
    const { data, error } = await supabase.from("drivers")
      .select("*").eq("company_id", currentCompanyId)
      .order("full_name");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Driver[]);
  };
  useEffect(() => { load(); }, [currentCompanyId]);

  const openNew = () => { setEditing(null); setForm(blank()); setArchivedDoc(null); setOpen(true); };
  const openEdit = (d: Driver) => { setEditing(d); setForm({ ...blank(), ...d }); setArchivedDoc(null); setOpen(true); };

  const upload = async (file: File) => {
    if (!currentCompanyId) return;
    setUploading(true);
    const path = `${currentCompanyId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("driver-photos").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: pub } = supabase.storage.from("driver-photos").getPublicUrl(path);
    setForm((f: any) => ({ ...f, photo_url: pub.publicUrl }));
    setUploading(false);
  };

  const aiFill = async (file: File) => {
    if (!currentCompanyId) return toast.error("Selecione uma empresa");
    setAiBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "driver", file, bucket: "driver-photos", companyId: currentCompanyId,
      });
      setForm((f: any) => ({
        ...f,
        full_name: data.full_name ?? f.full_name,
        cpf: data.cpf ? String(data.cpf).replace(/\D/g, "") : f.cpf,
        cnh_number: data.cnh_number ?? f.cnh_number,
        cnh_category: data.cnh_category ?? f.cnh_category,
        cnh_expires_at: data.cnh_expires_at ?? f.cnh_expires_at,
        medical_exam_expires_at: data.medical_exam_expires_at ?? f.medical_exam_expires_at,
        address: data.address ?? f.address,
      }));
      setArchivedDoc(archivedUrl);
      toast.success("Dados preenchidos pela IA. Revise antes de salvar.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar documento");
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!currentCompanyId) return;
    if (!form.full_name.trim()) return toast.error("Nome obrigatório");
    setBusy(true);
    const payload: any = {
      ...form, company_id: currentCompanyId,
      cnh_expires_at: form.cnh_expires_at || null,
      medical_exam_expires_at: form.medical_exam_expires_at || null,
    };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const op = editing
      ? supabase.from("drivers").update(payload).eq("id", editing.id)
      : supabase.from("drivers").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Motorista atualizado" : "Motorista cadastrado");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este motorista?")) return;
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Motorista removido"); load();
  };

  const filtered = items.filter((d) => d.full_name.toLowerCase().includes(q.toLowerCase()));
  const isExpiringSoon = (date: string | null) => date && new Date(date) <= new Date(Date.now() + 30 * 86400000);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Motoristas</h1>
          <p className="text-muted-foreground">{items.length} motorista(s) cadastrado(s)</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo motorista
        </Button>
      </div>

      <div className="surface-card rounded-xl p-4">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum motorista</h3>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const cnhAlert = isExpiringSoon(d.cnh_expires_at);
            return (
              <div key={d.id} className="surface-card rounded-xl p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground font-bold shrink-0 overflow-hidden">
                    {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : d.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{d.full_name}</h3>
                    <p className="text-xs text-muted-foreground">CPF: {d.cpf ?? "—"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="capitalize text-xs">{d.status}</Badge>
                      {d.cnh_category && <Badge variant="outline" className="text-xs font-mono">CNH {d.cnh_category}</Badge>}
                    </div>
                  </div>
                </div>
                {cnhAlert && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5" /> CNH vence em breve
                  </div>
                )}
                <div className="flex gap-2 pt-3 mt-3 border-t border-border">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar motorista" : "Novo motorista"}</DialogTitle></DialogHeader>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Preencher com IA</p>
              <p className="text-xs text-muted-foreground">Envie a foto ou PDF da CNH — extraímos os dados e arquivamos.</p>
            </div>
            <label>
              <Button type="button" size="sm" disabled={aiBusy} asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow cursor-pointer">
                <span>
                  {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                  {aiBusy ? "Lendo..." : "Enviar CNH"}
                </span>
              </Button>
              <input
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) aiFill(f); e.currentTarget.value = ""; }}
              />
            </label>
          </div>
          {archivedDoc && (
            <a href={archivedDoc} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              <FileText className="h-3 w-3" /> Documento arquivado
            </a>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Foto</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-muted overflow-hidden grid place-items-center">
                  {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-6 w-6 text-muted-foreground" />}
                </div>
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />} Enviar</span>
                  </Button>
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                </label>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>CNH número</Label><Input value={form.cnh_number} onChange={(e) => setForm({ ...form, cnh_number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={form.cnh_category} onChange={(e) => setForm({ ...form, cnh_category: e.target.value })} placeholder="A, B, D, E..." /></div>
            <div className="space-y-2"><Label>Validade CNH</Label><Input type="date" value={form.cnh_expires_at} onChange={(e) => setForm({ ...form, cnh_expires_at: e.target.value })} /></div>
            <div className="space-y-2"><Label>Validade exames</Label><Input type="date" value={form.medical_exam_expires_at} onChange={(e) => setForm({ ...form, medical_exam_expires_at: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
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
