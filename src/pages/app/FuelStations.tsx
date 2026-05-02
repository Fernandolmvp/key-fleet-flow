import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, Loader2, Fuel, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabPermissions } from "@/lib/permissions";

interface Station {
  id: string; name: string; cnpj: string | null; brand: string | null;
  address: string | null; city: string | null; state: string | null;
  phone: string | null; contact_name: string | null; fuel_types: string[];
  notes: string | null; active: boolean;
  inactivated_at: string | null; inactive_reason: string | null;
}

const FUEL_TYPES = ["gasolina", "etanol", "diesel_s10", "diesel_s500", "gnv", "flex"];

const blank = () => ({
  name: "", cnpj: "", brand: "", address: "", city: "", state: "",
  phone: "", contact_name: "", fuel_types: [] as string[], notes: "", active: true,
  inactivated_at: "", inactive_reason: "",
});

export default function FuelStations() {
  const { currentCompanyId, user } = useAuth();
  const [items, setItems] = useState<Station[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [form, setForm] = useState<any>(blank());
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<string>(() => localStorage.getItem("stations:tab") || "ativos");
  useEffect(() => { localStorage.setItem("stations:tab", tab); }, [tab]);

  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "fuel_stations", ["ativos", "inativos", "todos"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback);
  }, [isVisible, fallback]);

  const load = async () => {
    if (!currentCompanyId) return;
    const { data, error } = await supabase.from("fuel_stations")
      .select("*").eq("company_id", currentCompanyId).order("name");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Station[]);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const openNew = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (s: Station) => {
    setEditing(s);
    setForm({ ...blank(), ...s, fuel_types: s.fuel_types ?? [] });
    setOpen(true);
  };

  const toggleFuel = (f: string) => {
    setForm((prev: any) => ({
      ...prev,
      fuel_types: prev.fuel_types.includes(f)
        ? prev.fuel_types.filter((x: string) => x !== f)
        : [...prev.fuel_types, f],
    }));
  };

  const save = async () => {
    if (!currentCompanyId) return;
    if (!form.name) return toast.error("Informe o nome do posto");
    setBusy(true);
    const payload: any = {
      ...form,
      company_id: currentCompanyId,
      cnpj: form.cnpj || null,
      state: form.state ? form.state.toUpperCase() : null,
      inactivated_at: form.inactivated_at || null,
      inactive_reason: form.inactive_reason || null,
    };
    if (!editing) payload.created_by = user?.id;
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const op = editing
      ? supabase.from("fuel_stations").update(payload).eq("id", editing.id)
      : supabase.from("fuel_stations").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Posto atualizado" : "Posto cadastrado");
    setOpen(false); load();
  };

  const remove = async (s: Station) => {
    if (!confirm(`Excluir posto "${s.name}"?`)) return;
    const { error } = await supabase.from("fuel_stations").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Posto excluído"); load();
  };

  const byTab = items.filter((s) => {
    if (tab === "ativos") return s.active;
    if (tab === "inativos") return !s.active;
    return true;
  });
  const counts = {
    ativos: items.filter(s => s.active).length,
    inativos: items.filter(s => !s.active).length,
    todos: items.length,
  };
  const filtered = byTab.filter((s) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return (s.name + " " + (s.cnpj ?? "") + " " + (s.city ?? "") + " " + (s.brand ?? "")).toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Postos de Combustível</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro de postos parceiros para vincular aos abastecimentos</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo posto
        </Button>
      </div>

      <div className="surface-card rounded-xl p-4 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid">
            {canViewTab("ativos") && <TabsTrigger value="ativos">Ativos · {counts.ativos}</TabsTrigger>}
            {canViewTab("inativos") && <TabsTrigger value="inativos">Inativos · {counts.inativos}</TabsTrigger>}
            {canViewTab("todos") && <TabsTrigger value="todos">Todos · {counts.todos}</TabsTrigger>}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CNPJ, cidade ou bandeira" value={q} onChange={(e) => setQ(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Fuel className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum posto cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="surface-card rounded-xl p-5 space-y-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display font-semibold truncate">{s.name}</div>
                  {s.brand && <div className="text-xs text-muted-foreground">{s.brand}</div>}
                </div>
                <Badge variant={s.active ? "default" : "secondary"} className={s.active ? "bg-success/15 text-success border-success/30" : ""}>
                  {s.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {s.cnpj && <div className="font-mono text-xs text-muted-foreground">{s.cnpj}</div>}
              {(s.city || s.state) && (
                <div className="text-xs flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {[s.city, s.state].filter(Boolean).join(" / ")}
                </div>
              )}
              {s.fuel_types?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.fuel_types.map((f) => (
                    <span key={f} className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{f.replace("_", " ")}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
                <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar posto" : "Novo posto"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Bandeira</Label>
              <Input placeholder="Ex.: Petrobras, Shell, Ipiranga" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>UF</Label>
              <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2"><Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Contato</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Combustíveis disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {FUEL_TYPES.map((f) => {
                  const on = form.fuel_types.includes(f);
                  return (
                    <button key={f} type="button" onClick={() => toggleFuel(f)}
                      className={`text-xs uppercase font-mono px-2.5 py-1 rounded border transition-colors ${on ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30"}`}>
                      {f.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2"><Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex items-center gap-3 sm:col-span-2 pt-2 border-t border-border">
              <Switch id="active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label htmlFor="active" className="cursor-pointer">Posto ativo (disponível para seleção)</Label>
            </div>

            {!form.active && (
              <div className="sm:col-span-2 rounded-xl border border-border p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-semibold">Dados da inativação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Data da inativação</Label><Input type="date" value={form.inactivated_at} onChange={(e) => setForm({ ...form, inactivated_at: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Motivo</Label><Input value={form.inactive_reason} onChange={(e) => setForm({ ...form, inactive_reason: e.target.value })} placeholder="Ex.: contrato encerrado, posto fechado..." /></div>
                </div>
              </div>
            )}
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