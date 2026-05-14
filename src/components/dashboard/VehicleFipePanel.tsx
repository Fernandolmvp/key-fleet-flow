import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, History, TrendingDown, TrendingUp, DollarSign } from "lucide-react";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function VehicleFipePanel({ vehicleId, brand, model, year, onUpdated }: {
  vehicleId?: string | null; brand?: string; model?: string; year?: number | string | null; onUpdated?: () => void;
}) {
  const [vehicle, setVehicle] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const reload = async () => {
    if (!vehicleId) return;
    const { data } = await supabase.from("vehicles")
      .select("fipe_code, fipe_value, fipe_value_updated_at, fipe_reference_month")
      .eq("id", vehicleId).maybeSingle();
    setVehicle(data);
  };

  useEffect(() => { reload(); }, [vehicleId]);

  const consult = async () => {
    if (!vehicleId) {
      toast.error("Salve o veículo antes de consultar a FIPE");
      return;
    }
    if (!brand || !model) {
      toast.error("Marca e modelo são obrigatórios para consulta FIPE");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("fipe-lookup", {
        body: { vehicle_id: vehicleId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(`FIPE: ${data.error}`);
      } else {
        const dep = data?.depreciation_pct;
        toast.success(`Valor FIPE atualizado: ${fmt(data.fipe_value)}${dep != null ? ` (${dep > 0 ? "+" : ""}${dep}%)` : ""}`);
        await reload();
        onUpdated?.();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao consultar FIPE");
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async () => {
    if (!vehicleId) return;
    const { data } = await supabase.from("vehicle_fipe_history")
      .select("*").eq("vehicle_id", vehicleId).order("queried_at", { ascending: false });
    setHistory(data ?? []);
    setShowHistory(true);
  };

  const hasData = vehicle?.fipe_value != null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold">Valor FIPE</h4>
        <span className="text-[10px] text-muted-foreground">Tabela FIPE oficial</span>
      </div>

      {hasData ? (
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Valor atual</p>
            <p className="font-display font-bold text-lg text-success">{fmt(vehicle.fipe_value)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Atualizado em</p>
            <p className="font-mono">{fmtDate(vehicle.fipe_value_updated_at)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Mês referência</p>
            <p className="font-mono">{vehicle.fipe_reference_month ?? "—"}</p>
            {vehicle.fipe_code && <p className="text-[10px] text-muted-foreground">cód. {vehicle.fipe_code}</p>}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma consulta FIPE realizada ainda.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={consult} disabled={busy || !vehicleId}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          {hasData ? "Atualizar FIPE" : "Consultar FIPE pela 1ª vez"}
        </Button>
        {hasData && (
          <Button type="button" size="sm" variant="ghost" onClick={openHistory}>
            <History className="h-3.5 w-3.5 mr-1" /> Ver histórico
          </Button>
        )}
      </div>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico FIPE</DialogTitle></DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2">Data</th>
                    <th className="text-left">Mês ref.</th>
                    <th className="text-right">Valor</th>
                    <th className="text-right">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-border/50">
                      <td className="py-2 font-mono">{fmtDate(h.queried_at)}</td>
                      <td className="font-mono text-xs">{h.reference_month ?? "—"}</td>
                      <td className="text-right font-mono">{fmt(Number(h.fipe_value))}</td>
                      <td className="text-right font-mono">
                        {h.depreciation_pct == null ? "—" : (
                          <span className={`inline-flex items-center gap-1 ${Number(h.depreciation_pct) >= 0 ? "text-success" : "text-destructive"}`}>
                            {Number(h.depreciation_pct) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {h.depreciation_pct}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}