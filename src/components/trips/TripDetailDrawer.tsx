import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TRIP_STATUS, EXPENSE_CATEGORIES, PAYMENT_METHODS, formatBRL, labelOf, paymentGroup, categoryIcon } from "@/lib/trips";
import { toast } from "sonner";

export default function TripDetailDrawer({
  trip, drivers, vehicles, onClose, onChanged,
}: { trip: any; drivers: any[]; vehicles: any[]; onClose: () => void; onChanged: () => void }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);

  const load = async () => {
    const [exp, adv] = await Promise.all([
      supabase.from("trip_expenses").select("*").eq("trip_id", trip.id).order("expense_date", { ascending: false }),
      supabase.from("trip_advances").select("*").eq("trip_id", trip.id).order("advance_date", { ascending: false }),
    ]);
    setExpenses(exp.data ?? []);
    setAdvances(adv.data ?? []);
  };
  useEffect(() => { load(); }, [trip.id]);

  const status = TRIP_STATUS.find((s) => s.value === trip.status);
  const driver = drivers.find((d) => d.id === trip.driver_id);
  const vehicle = vehicles.find((v) => v.id === trip.vehicle_id);

  const advanceCash = Number(trip.total_advance_cash ?? 0);
  const spentCash = Number(trip.total_spent_cash ?? 0);
  const spentCard = Number(trip.total_spent_card ?? 0);
  const spentOther = Number(trip.total_spent_other ?? 0);
  const reimbursable = Number(trip.total_reimbursable ?? 0);
  const balance = Number(trip.balance_to_return ?? 0);

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    ...c, total: expenses.filter((e) => e.expense_category === c.value).reduce((s, e) => s + Number(e.amount), 0),
  })).filter((c) => c.total > 0);

  const totalSpent = spentCash + spentCard + spentOther + reimbursable;
  const withInvoice = expenses.filter((e) => e.has_invoice).reduce((s, e) => s + Number(e.amount), 0);
  const withoutInvoice = expenses.filter((e) => !e.has_invoice).reduce((s, e) => s + Number(e.amount), 0);

  const advance = async () => {
    const newStatus = trip.status === "programada" ? "em_andamento" :
                      trip.status === "em_andamento" ? "aguardando_acerto" :
                      trip.status === "aguardando_acerto" ? "finalizada" : trip.status;
    if (newStatus === trip.status) return;
    const { error } = await supabase.from("trips").update({ status: newStatus }).eq("id", trip.id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    onChanged(); onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-primary">{trip.trip_code}</div>
              <SheetTitle>{trip.title}</SheetTitle>
              <div className="text-xs text-muted-foreground mt-1">
                {driver?.full_name ?? "—"} · {vehicle ? `${vehicle.plate}${vehicle.model ? ` · ${vehicle.model}` : ""}` : "—"}
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${status?.color ?? ""}`}>{status?.label}</span>
          </div>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Adiantado" value={formatBRL(advanceCash)} />
          <Stat label="Saldo a devolver" value={formatBRL(balance)} accent />
          <Stat label="Gasto total" value={formatBRL(totalSpent)} />
          <Stat label="A reembolsar" value={formatBRL(reimbursable)} accent />
        </div>

        <div className="flex gap-2 mt-4">
          {trip.status !== "finalizada" && trip.status !== "cancelada" && (
            <Button onClick={advance} size="sm">
              {trip.status === "programada" ? "Iniciar viagem" :
               trip.status === "em_andamento" ? "Solicitar acerto" :
               trip.status === "aguardando_acerto" ? "Finalizar viagem" : "Avançar"}
            </Button>
          )}
        </div>

        <Tabs defaultValue="carteira" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="carteira" className="flex-1">Carteira</TabsTrigger>
            <TabsTrigger value="nf" className="flex-1">NF</TabsTrigger>
            <TabsTrigger value="categoria" className="flex-1">Categoria</TabsTrigger>
            <TabsTrigger value="todas" className="flex-1">Despesas</TabsTrigger>
          </TabsList>

          <TabsContent value="carteira" className="space-y-2 mt-4">
            <Row label="💰 Dinheiro adiantado" value={formatBRL(advanceCash)} sub={`Gasto: ${formatBRL(spentCash)} · Saldo: ${formatBRL(balance)}`} />
            <Row label="💳 Cartão empresa" value={formatBRL(spentCard)} />
            <Row label="📱 PIX/Vale empresa" value={formatBRL(spentOther)} />
            <Row label="👛 Motorista (reembolsar)" value={formatBRL(reimbursable)} />
          </TabsContent>

          <TabsContent value="nf" className="space-y-2 mt-4">
            <Row label="📄 Com nota fiscal" value={formatBRL(withInvoice)} />
            <Row label="⚠️ Sem NF" value={formatBRL(withoutInvoice)} sub="Apenas com recibo" />
          </TabsContent>

          <TabsContent value="categoria" className="space-y-2 mt-4">
            {byCategory.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma despesa registrada.</div>}
            {byCategory.map((c) => (
              <Row key={c.value} label={`${c.icon} ${c.label}`} value={formatBRL(c.total)} sub={totalSpent > 0 ? `${Math.round((c.total / totalSpent) * 100)}%` : ""} />
            ))}
          </TabsContent>

          <TabsContent value="todas" className="space-y-2 mt-4">
            {expenses.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma despesa registrada.</div>}
            {expenses.map((e) => (
              <div key={e.id} className="surface-card rounded-lg p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{categoryIcon(e.expense_category)} {labelOf(EXPENSE_CATEGORIES, e.expense_category)}</div>
                  <div className="font-mono">{formatBRL(Number(e.amount))}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(e.expense_date).toLocaleDateString("pt-BR")} · {labelOf(PAYMENT_METHODS, e.payment_method)} · {e.has_invoice ? "Com NF" : "Sem NF"}
                </div>
                {e.description && <div className="text-xs mt-1">{e.description}</div>}
                {e.requires_reimbursement && (
                  <div className="text-[10px] uppercase mt-1 tracking-wider text-warning">Reembolso: {e.reimbursement_status}</div>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {advances.length > 0 && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Adiantamentos</div>
            {advances.map((a) => (
              <div key={a.id} className="surface-card rounded-lg p-3 text-sm flex justify-between">
                <div>
                  <div className="font-medium">{formatBRL(Number(a.amount))} · {a.payment_method_used}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.advance_date).toLocaleString("pt-BR")} · {a.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="surface-card rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 surface-card rounded-lg p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}