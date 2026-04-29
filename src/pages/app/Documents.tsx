import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, AlertTriangle, Search, Pencil, Trash2, ExternalLink, ShieldAlert } from "lucide-react";
import DocumentDialog, { DocFormDoc } from "@/components/dashboard/DocumentDialog";
import { DOC_TYPE_LABELS, STATUS_COLOR, STATUS_LABEL, daysUntil, DocStatus } from "@/lib/documents";
import { toast } from "sonner";
import { format } from "date-fns";

type Row = {
  id: string;
  entity_type: "vehicle" | "driver";
  entity_id: string;
  doc_type: string;
  title: string | null;
  document_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expires_at: string | null;
  status: DocStatus;
  file_url: string | null;
  validation_warning: string | null;
  ai_extracted: any;
  // joined
  entity_label?: string;
};

export default function Documents() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocFormDoc | null>(null);

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data: docs, error } = await supabase
      .from("documents")
      .select("*")
      .eq("company_id", currentCompanyId)
      .order("expires_at", { ascending: true, nullsFirst: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const vehicleIds = Array.from(new Set((docs || []).filter((d) => d.entity_type === "vehicle").map((d) => d.entity_id)));
    const driverIds = Array.from(new Set((docs || []).filter((d) => d.entity_type === "driver").map((d) => d.entity_id)));
    const [v, d] = await Promise.all([
      vehicleIds.length ? supabase.from("vehicles").select("id,plate,brand,model").in("id", vehicleIds) : Promise.resolve({ data: [] as any[] }),
      driverIds.length ? supabase.from("drivers").select("id,full_name").in("id", driverIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const vMap = new Map((v.data || []).map((x: any) => [x.id, `${x.plate} — ${x.brand} ${x.model}`]));
    const dMap = new Map((d.data || []).map((x: any) => [x.id, x.full_name]));

    setRows((docs || []).map((doc: any) => ({
      ...doc,
      entity_label: doc.entity_type === "vehicle" ? vMap.get(doc.entity_id) || "—" : dMap.get(doc.entity_id) || "—",
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [currentCompanyId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.entity_label || "").toLowerCase().includes(q) ||
        (r.document_number || "").toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        DOC_TYPE_LABELS[r.doc_type]?.toLowerCase().includes(q)
      );
    }
    return true;
  }), [rows, search, statusFilter, entityFilter]);

  const stats = useMemo(() => ({
    total: rows.length,
    vencidos: rows.filter((r) => r.status === "vencido").length,
    vencendo: rows.filter((r) => r.status === "vencendo").length,
    validos: rows.filter((r) => r.status === "valido").length,
  }), [rows]);

  async function remove(id: string) {
    if (!confirm("Excluir este documento?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Documentação</h1>
          <p className="text-sm text-muted-foreground">Gerencie documentos com extração e validação por IA.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo documento
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Válidos</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{stats.validos}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vencendo (30d)</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{stats.vencendo}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vencidos</div>
          <div className="text-2xl font-bold mt-1 text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{stats.vencidos}</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por placa, motorista, número..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            <SelectItem value="vehicle">Veículos</SelectItem>
            <SelectItem value="driver">Motoristas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="vencendo">Vencendo</SelectItem>
            <SelectItem value="valido">Válidos</SelectItem>
            <SelectItem value="sem_validade">Sem validade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Vinculado a</th>
                <th className="text-left px-4 py-3">Número</th>
                <th className="text-left px-4 py-3">Vencimento</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum documento.</td></tr>
              )}
              {filtered.map((r) => {
                const dl = daysUntil(r.expires_at);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{DOC_TYPE_LABELS[r.doc_type] || r.doc_type}</div>
                      {r.title && <div className="text-xs text-muted-foreground">{r.title}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="mr-2">{r.entity_type === "vehicle" ? "Veículo" : "Motorista"}</Badge>
                      {r.entity_label}
                      {r.validation_warning && (
                        <div className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                          <ShieldAlert className="h-3 w-3" /> {r.validation_warning}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.document_number || "—"}</td>
                    <td className="px-4 py-3">
                      {r.expires_at ? (
                        <div>
                          <div>{format(new Date(r.expires_at + "T00:00:00"), "dd/MM/yyyy")}</div>
                          {dl !== null && (
                            <div className="text-xs text-muted-foreground">
                              {dl < 0 ? `${Math.abs(dl)} dias atrás` : `em ${dl} dias`}
                            </div>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLOR[r.status]} variant="outline">{STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.file_url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={r.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(r as any); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {currentCompanyId && (
        <DocumentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={currentCompanyId}
          doc={editing}
          onSaved={load}
        />
      )}
    </div>
  );
}