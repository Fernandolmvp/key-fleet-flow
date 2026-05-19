import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";

export default function OficinaEquipe() {
  const { token } = useWorkshopAuth();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "mecanico" });
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: any) {
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText); return j;
  }

  async function load() {
    setLoading(true);
    try { const j = await call("workshop-team"); setList(j.rows ?? []); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await call("workshop-team", { action: "invite", ...form });
      toast.success("Convite enviado");
      setOpen(false); setForm({ name: "", email: "", role: "mecanico" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function toggle(u: any) {
    try { await call("workshop-team", { action: "toggle_active", user_id: u.id, is_active: !u.is_active }); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Equipe da oficina</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4" />Convidar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Convidar mecânico</DialogTitle></DialogHeader>
            <form onSubmit={invite} className="space-y-3">
              <div><Label>Nome</Label><Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div>
                <Label>Papel</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mecanico">Mecânico</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar convite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="surface-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40"><tr>
              <th className="text-left p-3">Nome</th><th className="text-left p-3">Email</th>
              <th className="text-left p-3">Papel</th><th className="text-left p-3">Status</th><th></th>
            </tr></thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 capitalize">{u.role}</td>
                  <td className="p-3">{u.is_active ? <span className="text-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggle(u)}>
                      {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum membro ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}