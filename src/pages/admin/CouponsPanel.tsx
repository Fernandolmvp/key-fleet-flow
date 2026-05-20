import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Ticket, Plus, Search, Loader2, Power, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

type Coupon = {
  id: string;
  code: string;
  type: "trial_days" | "discount_percent" | "discount_fixed";
  trial_days: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  discount_months: number | null;
  max_uses: number | null;
  current_uses: number;
  restrict_to_cnpj: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
};

const randomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};

function typeLabel(c: Coupon) {
  if (c.type === "trial_days") return `${c.trial_days ?? 0} dias grátis`;
  if (c.type === "discount_percent") return `${c.discount_percent ?? 0}% off${c.discount_months ? ` · ${c.discount_months}m` : ""}`;
  return `R$ ${Number(c.discount_amount ?? 0).toFixed(2)} off${c.discount_months ? ` · ${c.discount_months}m` : ""}`;
}

function statusOf(c: Coupon): { label: string; tone: string } {
  const now = new Date();
  if (!c.is_active) return { label: "Inativo", tone: "bg-muted text-muted-foreground" };
  if (c.valid_until && new Date(c.valid_until) < now) return { label: "Expirado", tone: "bg-destructive/20 text-destructive border-destructive/30" };
  if (c.max_uses && c.current_uses >= c.max_uses) return { label: "Esgotado", tone: "bg-warning/20 text-warning border-warning/30" };
  if (new Date(c.valid_from) > now) return { label: "Agendado", tone: "bg-primary/20 text-primary border-primary/30" };
  return { label: "Ativo", tone: "bg-success/20 text-success border-success/30" };
}

export default function CouponsPanel() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("coupons" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all") {
        const s = statusOf(c).label.toLowerCase();
        if (statusFilter === "active" && s !== "ativo") return false;
        if (statusFilter === "inactive" && s !== "inativo") return false;
        if (statusFilter === "expired" && s !== "expirado") return false;
      }
      if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, typeFilter, statusFilter]);

  const toggleActive = async (c: Coupon) => {
    const { error } = await supabase.from("coupons" as any).update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(!c.is_active ? "Cupom ativado" : "Cupom desativado"); reload(); }
  };

  const remove = async (c: Coupon) => {
    if (c.current_uses > 0) return toast.error("Cupom já foi usado, não pode ser excluído");
    if (!confirm(`Excluir cupom ${c.code}?`)) return;
    const { error } = await supabase.from("coupons" as any).delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Cupom excluído"); reload(); }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" /> Cupons
          </h1>
          <p className="text-sm text-muted-foreground">Gere códigos de dias grátis ou descontos para empresas</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="trial_days">Dias grátis</SelectItem>
            <SelectItem value="discount_percent">Desconto %</SelectItem>
            <SelectItem value="discount_fixed">Desconto R$</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : (
        <div className="surface-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Código</th>
                <th className="text-left px-4 py-3">Tipo / Valor</th>
                <th className="text-left px-4 py-3">Usos</th>
                <th className="text-left px-4 py-3">Validade</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const s = statusOf(c);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                    <td className="px-4 py-3">{typeLabel(c)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.current_uses} / {c.max_uses ?? "∞"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.valid_until ? `até ${new Date(c.valid_until).toLocaleDateString("pt-BR")}` : "sem expiração"}
                    </td>
                    <td className="px-4 py-3"><Badge className={`border ${s.tone}`}>{s.label}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost"><Link to={`/super-admin/cupons/${c.id}`}><Eye className="h-3.5 w-3.5" /></Link></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(c)} title={c.is_active ? "Desativar" : "Ativar"}>
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        {c.current_uses === 0 && (
                          <Button size="sm" variant="ghost" onClick={() => remove(c)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum cupom encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CouponDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={reload} />
    </div>
  );
}

function CouponDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Coupon | null; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    code: "", type: "trial_days", trial_days: 30,
    discount_percent: 10, discount_amount: 50, discount_months: 1,
    max_uses: "", restrict_to_cnpj: "",
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: "",
    is_active: true, description: "",
  });

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code,
        type: editing.type,
        trial_days: editing.trial_days ?? 30,
        discount_percent: editing.discount_percent ?? 10,
        discount_amount: editing.discount_amount ?? 50,
        discount_months: editing.discount_months ?? 1,
        max_uses: editing.max_uses ?? "",
        restrict_to_cnpj: editing.restrict_to_cnpj ?? "",
        valid_from: editing.valid_from.slice(0, 10),
        valid_until: editing.valid_until ? editing.valid_until.slice(0, 10) : "",
        is_active: editing.is_active,
        description: editing.description ?? "",
      });
    } else {
      setForm((f: any) => ({ ...f, code: "", description: "", max_uses: "", restrict_to_cnpj: "", valid_until: "" }));
    }
  }, [editing, open]);

  const submit = async () => {
    setBusy(true);
    const payload: any = {
      code: (form.code || randomCode()).toUpperCase(),
      type: form.type,
      trial_days: form.type === "trial_days" ? Number(form.trial_days) : null,
      discount_percent: form.type === "discount_percent" ? Number(form.discount_percent) : null,
      discount_amount: form.type === "discount_fixed" ? Number(form.discount_amount) : null,
      discount_months: form.type !== "trial_days" ? (Number(form.discount_months) || 1) : null,
      max_uses: form.max_uses === "" ? null : Number(form.max_uses),
      restrict_to_cnpj: form.restrict_to_cnpj || null,
      valid_from: new Date(form.valid_from).toISOString(),
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      is_active: form.is_active,
      description: form.description || null,
    };
    const q = editing
      ? supabase.from("coupons" as any).update(payload).eq("id", editing.id)
      : supabase.from("coupons" as any).insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cupom atualizado" : "Cupom criado");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cupom" : "Novo cupom"}</DialogTitle>
          <DialogDescription>Códigos sempre maiúsculos. Deixe em branco para gerar automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Código</Label>
            <div className="flex gap-2">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex.: FROTAGRATIS" className="font-mono" />
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, code: randomCode() })}>Gerar</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial_days">Dias grátis</SelectItem>
                <SelectItem value="discount_percent">Desconto percentual (%)</SelectItem>
                <SelectItem value="discount_fixed">Desconto fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.type === "trial_days" && (
            <div className="space-y-2">
              <Label>Dias de trial</Label>
              <Input type="number" min={1} value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} />
            </div>
          )}
          {form.type === "discount_percent" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Desconto (%)</Label>
                <Input type="number" min={1} max={100} value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Meses (1 = só primeira)</Label>
                <Input type="number" min={1} max={12} value={form.discount_months} onChange={(e) => setForm({ ...form, discount_months: e.target.value })} />
              </div>
            </div>
          )}
          {form.type === "discount_fixed" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Desconto (R$)</Label>
                <Input type="number" min={1} step="0.01" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Meses</Label>
                <Input type="number" min={1} max={12} value={form.discount_months} onChange={(e) => setForm({ ...form, discount_months: e.target.value })} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Máximo de usos (vazio = ∞)</Label>
              <Input type="number" min={1} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Restringir ao CNPJ</Label>
              <Input value={form.restrict_to_cnpj} onChange={(e) => setForm({ ...form, restrict_to_cnpj: e.target.value })} placeholder="opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Válido a partir de</Label>
              <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Válido até</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}