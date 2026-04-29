import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { PREVENTIVE_CHECKLIST } from "@/lib/checklist";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  maintenanceRecordId: string | null;
  vehiclePlate?: string;
}

interface Row {
  item_key: string;
  item_label: string;
  category: string | null;
  checked: boolean;
  notes: string | null;
}

export default function ChecklistDialog({ open, onOpenChange, maintenanceRecordId, vehiclePlate }: Props) {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !maintenanceRecordId || !currentCompanyId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("maintenance_checklist_items")
        .select("item_key,item_label,category,checked,notes")
        .eq("maintenance_record_id", maintenanceRecordId);
      const existing = new Map<string, any>();
      (data ?? []).forEach((r: any) => existing.set(r.item_key, r));
      const merged: Row[] = PREVENTIVE_CHECKLIST.map((it) => ({
        item_key: it.key,
        item_label: it.label,
        category: it.category,
        checked: existing.get(it.key)?.checked ?? false,
        notes: existing.get(it.key)?.notes ?? "",
      }));
      setRows(merged);
      setLoading(false);
    })();
  }, [open, maintenanceRecordId, currentCompanyId]);

  const toggle = (key: string, checked: boolean) =>
    setRows((rs) => rs.map((r) => (r.item_key === key ? { ...r, checked } : r)));
  const setNote = (key: string, notes: string) =>
    setRows((rs) => rs.map((r) => (r.item_key === key ? { ...r, notes } : r)));

  const save = async () => {
    if (!maintenanceRecordId || !currentCompanyId) return;
    setBusy(true);
    // Estratégia simples: apaga e reinsere
    await supabase.from("maintenance_checklist_items").delete().eq("maintenance_record_id", maintenanceRecordId);
    const payload = rows.map((r) => ({
      maintenance_record_id: maintenanceRecordId,
      company_id: currentCompanyId,
      item_key: r.item_key,
      item_label: r.item_label,
      category: r.category,
      checked: r.checked,
      notes: r.notes || null,
    }));
    const { error } = await supabase.from("maintenance_checklist_items").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Checklist salvo");
    onOpenChange(false);
  };

  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => {
    const k = r.category ?? "Geral";
    (acc[k] ??= []).push(r);
    return acc;
  }, {});
  const total = rows.length;
  const done = rows.filter((r) => r.checked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Checklist Preventivo {vehiclePlate && <span className="font-mono text-primary">· {vehiclePlate}</span>}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{done}/{total} itens marcados</p>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="surface-card rounded-lg p-4 space-y-2">
                <h4 className="font-display font-semibold text-sm text-primary">{cat}</h4>
                {items.map((r) => (
                  <div key={r.item_key} className="flex items-start gap-3 py-1">
                    <Checkbox
                      checked={r.checked}
                      onCheckedChange={(v) => toggle(r.item_key, !!v)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_240px] gap-2">
                      <span className={`text-sm ${r.checked ? "line-through text-muted-foreground" : ""}`}>{r.item_label}</span>
                      <Input
                        placeholder="Observação..."
                        value={r.notes ?? ""}
                        onChange={(e) => setNote(r.item_key, e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy} className="bg-gradient-primary text-primary-foreground">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}