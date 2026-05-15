import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TRIP_STATUS, EXPENSE_CATEGORIES, PAYMENT_METHODS, formatBRL, labelOf, tripBalance, categoryIcon } from "@/lib/trips";
import { ArrowLeft, Loader2, Plus, Wallet, Check } from "lucide-react";
import ExpenseWizard from "@/components/motorista/ExpenseWizard";
import { toast } from "sonner";

export default function MotoristaViagemDetalhe() {
  const { id } = useParams();
  const [trip, setTrip] = useState<any | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState(false);

  const load = async () => {
    if (!id) return;
    const [t, e, a] = await Promise.all([
      supabase.from("trips").select("*").eq("id", id).maybeSingle(),
      supabase.from("trip_expenses").select("*").eq("trip_id", id).order("expense_date", { ascending: false }),
      supabase.from("trip_advances").select("*").eq("trip_id", id).order("advance_date", { ascending: false }),
    ]);
    setTrip(t.data); setExpenses(e.data ?? []); setAdvances(a.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const confirmAdvance = async (adv: any) => {
    const { error } = await supabase.from("trip_advances").update({
      status: "confirmado", driver_confirmed_at: new Date().toISOString(),
      driver_confirmation_method: "app",
    }).eq("id", adv.id);
    if (error) return toast.error(error.message);
    toast.success("Adiantamento confirmado");
    load();
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!trip) return <div className="p-6 text-center text-muted-foreground">Viagem não encontrada</div>;

  const status = TRIP_STATUS.find((s) => s.value === trip.status);
  const bal = tripBalance(trip);
  const totalSpent = Number(trip.total_spent_cash ?? 0) + Number(trip.total_spent_card ?? 0) + Number(trip.total_spent_other ?? 0) + Number(trip.total_reimbursable ?? 0);
  const pendingAdvances = advances.filter((a) => a.status === "aguardando_confirmacao");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3 z-10">
        <Link to="/motorista/viagens" className="p-1.5 rounded hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-primary">{trip.trip_code}</div>
          <h1 className="font-semibold truncate">{trip.title}</h1>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${status?.color ?? ""}`}>{status?.label}</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="surface-card rounded-xl p-4 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider"><Wallet className="h-3.5 w-3.5" /> Saldo em mãos</div>
          <div className="text-3xl font-mono font-bold mt-1">{formatBRL(bal)}</div>
          <div className="text-xs text-muted-foreground mt-1">Adiantado: {formatBRL(Number(trip.total_advance_cash ?? 0))} · Gasto: {formatBRL(Number(trip.total_spent_cash ?? 0))}</div>
        </div>

        {pendingAdvances.length > 0 && (
          <div className="surface-card rounded-xl p-4 border-warning/40 space-y-2">
            <div className="text-sm font-semibold">Adiantamentos para confirmar</div>
            {pendingAdvances.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded">
                <div>
                  <div className="font-mono font-semibold">{formatBRL(Number(a.amount))}</div>
                  <div className="text-xs text-muted-foreground">{a.payment_method_used} · {new Date(a.advance_date).toLocaleString("pt-BR")}</div>
                </div>
                <Button size="sm" onClick={() => confirmAdvance(a)}><Check className="h-4 w-4 mr-1" /> Recebi</Button>
              </div>
            ))}
          </div>
        )}

        {trip.status === "em_andamento" && (
          <Button size="lg" className="w-full" onClick={() => setWizard(true)}>
            <Plus className="h-5 w-5 mr-2" /> Lançar despesa
          </Button>
        )}

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">Minhas despesas ({expenses.length})</div>
          {expenses.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa lançada</div>}
          {expenses.map((e) => (
            <div key={e.id} className="surface-card rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{categoryIcon(e.expense_category)} {labelOf(EXPENSE_CATEGORIES, e.expense_category)}</div>
                <div className="font-mono">{formatBRL(Number(e.amount))}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(e.expense_date).toLocaleDateString("pt-BR")} · {labelOf(PAYMENT_METHODS, e.payment_method)} · {e.has_invoice ? "Com NF" : "Sem NF"}
              </div>
            </div>
          ))}
        </div>

        <div className="surface-card rounded-xl p-3 mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total gasto</span>
            <span className="font-mono font-semibold">{formatBRL(totalSpent)}</span>
          </div>
        </div>
      </div>

      <ExpenseWizard open={wizard} onOpenChange={setWizard} trip={trip} onSaved={load} />
    </div>
  );
}