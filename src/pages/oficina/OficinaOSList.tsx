import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";
import { toast } from "sonner";

type Row = {
  id: string;
  os_number: string;
  title: string;
  priority: string;
  problem_category: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  quote_status: string;
  quote_amount_total: number | null;
  execution_status: string;
  actual_amount_total: number | null;
  payment_status: string;
  rating: number | null;
  company: { name: string } | null;
  vehicle: { plate: string; brand: string; model: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação", aprovado_aguardando_inicio: "Aprovada",
  em_execucao: "Em execução", aguardando_pecas: "Aguarda peças",
  concluido: "Concluída", cancelado: "Cancelada", problema_relatado: "Problema",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aguardando_aprovacao: "secondary", aprovado_aguardando_inicio: "secondary",
  em_execucao: "default", aguardando_pecas: "secondary",
  concluido: "outline", cancelado: "destructive", problema_relatado: "destructive",
};
const QUOTE_LABEL: Record<string, string> = {
  pendente: "Pendente", em_elaboracao: "Em elaboração", enviado: "Enviado",
  aprovado: "Aprovado", rejeitado: "Rejeitado", expirado: "Expirado",
};

function fmtMoney(n: number | null) {
  if (n == null) return "—";
  return "R$ " + new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(Number(n));
}

export default function OficinaOSList() {
  const { authedFetch } = useWorkshopAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await authedFetch<{ rows: Row[] }>(`workshop-list?${params.toString()}`);
      setRows(res.rows);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.os_number.toLowerCase().includes(s) ||
      r.title?.toLowerCase().includes(s) ||
      r.vehicle?.plate?.toLowerCase().includes(s) ||
      r.company?.name?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="OS, título, placa, empresa…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
          <option value="">Todos</option>
          <option value="aguardando_aprovacao">Aguardando aprovação</option>
          <option value="aprovado_aguardando_inicio">Aprovadas</option>
          <option value="em_execucao">Em execução</option>
          <option value="aguardando_pecas">Aguardando peças</option>
          <option value="concluido">Concluídas</option>
          </select>
        </div>
        <Button onClick={load} disabled={loading} className="gap-2 bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Atualizar
        </Button>
      </div>

      <div className="surface-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">OS</th>
                <th className="text-left px-3 py-2">Veículo</th>
                <th className="text-left px-3 py-2">Empresa</th>
                <th className="text-left px-3 py-2">Título</th>
                <th className="text-left px-3 py-2">Agendada</th>
                <th className="text-left px-3 py-2">Orçamento</th>
                <th className="text-left px-3 py-2">Execução</th>
                <th className="text-right px-3 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma OS</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => nav(`/oficina/os/${r.id}`)} className="border-t border-border hover:bg-muted/20 cursor-pointer">
                  <td className="px-3 py-2 font-mono font-semibold text-primary">{r.os_number}</td>
                  <td className="px-3 py-2">
                    <div className="font-mono">{r.vehicle?.plate ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.vehicle?.brand} {r.vehicle?.model}</div>
                  </td>
                  <td className="px-3 py-2">{r.company?.name ?? "—"}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{r.title}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString("pt-BR") : "—"}
                    {r.scheduled_time ? ` ${r.scheduled_time.slice(0,5)}` : ""}
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{QUOTE_LABEL[r.quote_status] ?? r.quote_status}</Badge></td>
                  <td className="px-3 py-2"><Badge variant={STATUS_VARIANT[r.execution_status] ?? "outline"}>{STATUS_LABEL[r.execution_status] ?? r.execution_status}</Badge></td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmtMoney(r.actual_amount_total ?? r.quote_amount_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}