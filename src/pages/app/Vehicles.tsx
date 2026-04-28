import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Truck, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import VehicleDialog from "@/components/dashboard/VehicleDialog";
import { Badge } from "@/components/ui/badge";

interface Vehicle {
  id: string; plate: string; brand: string; model: string; year_model: number | null;
  status: string; current_km: number; fuel_type: string | null; photos: string[];
}

const statusTone: Record<string, string> = {
  ativo: "bg-success/20 text-success border-success/30",
  manutencao: "bg-warning/20 text-warning border-warning/30",
  vendido: "bg-muted text-muted-foreground",
  parado: "bg-destructive/20 text-destructive border-destructive/30",
  sinistrado: "bg-destructive/30 text-destructive border-destructive/40",
};

export default function Vehicles() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<Vehicle[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase.from("vehicles")
      .select("id,plate,brand,model,year_model,status,current_km,fuel_type,photos")
      .eq("company_id", currentCompanyId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Vehicle[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este veículo?")) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Veículo removido");
    load();
  };

  const filtered = items.filter((v) =>
    [v.plate, v.brand, v.model].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Veículos</h1>
          <p className="text-muted-foreground">{items.length} veículo(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo veículo
        </Button>
      </div>

      <div className="surface-card rounded-xl p-4">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por placa, marca, modelo..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum veículo</h3>
          <p className="text-sm text-muted-foreground mt-1">Cadastre o primeiro veículo da frota.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <div key={v.id} className="surface-card rounded-xl overflow-hidden hover:border-primary/40 transition-colors group">
              <div className="aspect-video bg-muted/30 relative">
                {v.photos?.[0] ? (
                  <img src={v.photos[0]} alt={v.plate} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full grid place-items-center text-muted-foreground">
                    <Truck className="h-12 w-12 opacity-40" />
                  </div>
                )}
                <Badge className={`absolute top-3 right-3 capitalize border ${statusTone[v.status] ?? ""}`}>{v.status}</Badge>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="font-mono text-lg font-bold tracking-wider text-primary">{v.plate}</div>
                  <div className="text-sm text-muted-foreground">{v.brand} {v.model} {v.year_model ?? ""}</div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>KM: <span className="font-mono text-foreground">{v.current_km.toLocaleString("pt-BR")}</span></span>
                  <span className="capitalize">{v.fuel_type ?? "—"}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setEditing(v as any); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <VehicleDialog open={open} onOpenChange={setOpen} vehicle={editing} onSaved={load} />
    </div>
  );
}
