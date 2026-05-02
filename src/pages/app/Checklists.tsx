import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ListChecks, Play, Pencil, Search, ClipboardList, AlertTriangle, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ChecklistTemplateBuilder from "@/components/dashboard/ChecklistTemplateBuilder";
import ChecklistRunDialog from "@/components/dashboard/ChecklistRunDialog";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE, currentMonthRef, monthRefLabel } from "@/lib/checklists";
import { useTabPermissions } from "@/lib/permissions";

export default function Checklists() {
  const { currentCompanyId } = useAuth();
  const [tab, setTab] = useState<"pendentes" | "historico" | "modelos">("pendentes");
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditId, setTplEditId] = useState<string | null>(null);

  const [runOpen, setRunOpen] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const [startOpen, setStartOpen] = useState(false);
  const [startTplId, setStartTplId] = useState<string>("");
  const [startVehicleId, setStartVehicleId] = useState<string>("");
  const [startBusy, setStartBusy] = useState(false);

  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "checklists", ["pendentes", "historico", "modelos"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback as any);
  }, [isVisible, fallback]);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [{ data: tpls }, { data: rs }, { data: vs }] = await Promise.all([
      supabase.from("checklist_templates").select("*").eq("company_id", currentCompanyId).order("created_at", { ascending: false }),
      supabase
        .from("checklist_runs")
        .select("*, vehicle:vehicles(plate,brand,model), template:checklist_templates(name,frequency)")
        .eq("company_id", currentCompanyId)
        .order("created_at", { ascending: false }),
      supabase.from("vehicles").select("id,plate,brand,model").eq("company_id", currentCompanyId).eq("status", "ativo").order("plate"),
    ]);
    setTemplates(tpls ?? []);
    setRuns(rs ?? []);
    setVehicles(vs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return runs.filter((r) => {
      const txt = `${r.vehicle?.plate} ${r.vehicle?.brand} ${r.vehicle?.model} ${r.template?.name}`.toLowerCase();
      const matches = !s || txt.includes(s);
      if (!matches) return false;
      if (tab === "pendentes") return r.status === "pendente" || r.status === "em_andamento";
      if (tab === "historico") return r.status === "concluido" || r.status === "reprovado" || r.status === "cancelado";
      return true;
    });
  }, [runs, search, tab]);

  const counts = useMemo(() => ({
    pendentes: runs.filter((r) => r.status === "pendente" || r.status === "em_andamento").length,
    historico: runs.filter((r) => ["concluido", "reprovado", "cancelado"].includes(r.status)).length,
    modelos: templates.length,
  }), [runs, templates]);

  const kpis = useMemo(() => {
    const ref = currentMonthRef();
    const monthRuns = runs.filter((r) => r.reference_month === ref);
    const completed = monthRuns.filter((r) => r.status === "concluido" || r.status === "reprovado");
    const reproved = monthRuns.filter((r) => r.status === "reprovado");
    const avg = completed.length
      ? Math.round(completed.reduce((s, r) => s + (Number(r.score) || 0), 0) / completed.length)
      : null;
    return {
      pendentesMes: monthRuns.filter((r) => r.status === "pendente" || r.status === "em_andamento").length,
      concluidosMes: completed.length,
      reprovadosMes: reproved.length,
      mediaScore: avg,
    };
  }, [runs]);

  const startRun = async () => {
    if (!currentCompanyId || !startTplId || !startVehicleId) return toast.error("Selecione modelo e veículo");
    setStartBusy(true);
    const tpl = templates.find((t) => t.id === startTplId);
    // cria run
    const ref = currentMonthRef();
    const { data: runRow, error } = await supabase
      .from("checklist_runs")
      .insert({
        company_id: currentCompanyId,
        template_id: startTplId,
        vehicle_id: startVehicleId,
        reference_month: ref,
        status: "em_andamento",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !runRow) {
      setStartBusy(false);
      return toast.error(error?.message ?? "Erro ao iniciar");
    }
    // cria respostas vazias a partir das perguntas do template
    const { data: qs } = await supabase
      .from("checklist_questions")
      .select("*")
      .eq("template_id", startTplId)
      .order("sort_order");
    if (qs?.length) {
      const payload = qs.map((q: any) => ({
        run_id: runRow.id,
        question_id: q.id,
        company_id: currentCompanyId,
        question_label: q.label,
        question_category: q.category,
        question_type: q.question_type,
        status: "pendente" as const,
        photo_urls: [],
      }));
      await supabase.from("checklist_answers").insert(payload);
    }
    setStartBusy(false);
    setStartOpen(false);
    setStartTplId("");
    setStartVehicleId("");
    setRunId(runRow.id);
    setRunOpen(true);
    load();
    toast.success(`Checklist "${tpl?.name}" iniciado`);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este modelo? Execuções existentes serão preservadas.")) return;
    const { error } = await supabase.from("checklist_templates").update({ active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Modelo arquivado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Checklists
          </h1>
          <p className="text-sm text-muted-foreground">Inspeções mensais, registros fotográficos e abertura automática de OS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setTplEditId(null); setTplOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo modelo
          </Button>
          <Button onClick={() => setStartOpen(true)} className="bg-gradient-primary text-primary-foreground gap-2">
            <Play className="h-4 w-4" /> Iniciar checklist
          </Button>
        </div>
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" /> Pendentes — {monthRefLabel(currentMonthRef())}</div>
            <div className="text-2xl font-display font-bold mt-1">{kpis.pendentesMes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Concluídos no mês</div>
            <div className="text-2xl font-display font-bold mt-1 text-success">{kpis.concluidosMes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Reprovados no mês</div>
            <div className="text-2xl font-display font-bold mt-1 text-destructive">{kpis.reprovadosMes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Score médio do mês</div>
            <div className="text-2xl font-display font-bold mt-1 text-primary">{kpis.mediaScore !== null ? `${kpis.mediaScore}%` : "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            {canViewTab("pendentes") && <TabsTrigger value="pendentes">Pendentes · {counts.pendentes}</TabsTrigger>}
            {canViewTab("historico") && <TabsTrigger value="historico">Histórico · {counts.historico}</TabsTrigger>}
            {canViewTab("modelos") && <TabsTrigger value="modelos">Modelos · {counts.modelos}</TabsTrigger>}
          </TabsList>
          {tab !== "modelos" && (
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input placeholder="Buscar placa, modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          )}
        </div>

        <TabsContent value="pendentes" className="mt-4">
          <RunsList runs={filtered} loading={loading} onOpen={(id) => { setRunId(id); setRunOpen(true); }} />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <RunsList runs={filtered} loading={loading} onOpen={(id) => { setRunId(id); setRunOpen(true); }} />
        </TabsContent>
        <TabsContent value="modelos" className="mt-4">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : templates.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">
              <ListChecks className="h-10 w-10 mx-auto text-primary mb-3" />
              <p className="font-medium">Nenhum modelo de checklist criado ainda</p>
              <p className="text-xs mt-1">Crie um modelo padrão em segundos com o botão "Novo modelo".</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Card key={t.id} className="surface-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display font-semibold">{t.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.description || "Sem descrição"}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{t.frequency}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {t.auto_open_os && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">OS automática</Badge>}
                      {!t.active && <Badge variant="outline" className="bg-muted/40">Arquivado</Badge>}
                      <Badge variant="outline">v{t.version}</Badge>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => { setTplEditId(t.id); setTplOpen(true); }} className="gap-1">
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setStartTplId(t.id); setStartOpen(true); }} className="gap-1">
                        <Play className="h-3 w-3" /> Aplicar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)} className="text-destructive hover:bg-destructive/10 ml-auto">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ChecklistTemplateBuilder open={tplOpen} onOpenChange={setTplOpen} templateId={tplEditId} onSaved={load} />
      <ChecklistRunDialog open={runOpen} onOpenChange={setRunOpen} runId={runId} onSaved={load} />

      {/* Iniciar nova execução */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" /> Iniciar checklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modelo *</Label>
              <Select value={startTplId} onValueChange={setStartTplId}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                <SelectContent>
                  {templates.filter((t) => t.active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.filter((t) => t.active).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhum modelo ativo. Crie um na aba "Modelos".</p>
              )}
            </div>
            <div>
              <Label>Veículo *</Label>
              <Select value={startVehicleId} onValueChange={setStartVehicleId}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancelar</Button>
            <Button onClick={startRun} disabled={startBusy} className="bg-gradient-primary text-primary-foreground">
              {startBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunsList({ runs, loading, onOpen }: { runs: any[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;
  if (runs.length === 0) {
    return (
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        <ListChecks className="h-10 w-10 mx-auto text-primary mb-3" />
        <p className="font-medium">Nenhum checklist nessa visão</p>
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-2">
      {runs.map((r) => (
        <Card key={r.id} className="surface-card hover:border-primary/40 transition-colors cursor-pointer" onClick={() => onOpen(r.id)}>
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary font-semibold">{r.vehicle?.plate}</span>
                <span className="text-sm text-muted-foreground">{r.vehicle?.brand} {r.vehicle?.model}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {r.template?.name} · {r.reference_month ? monthRefLabel(r.reference_month) : "—"}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="text-muted-foreground">Itens</div>
              <div className="font-mono">
                <span className="text-success">{r.conform_items}</span> / <span className="text-destructive">{r.non_conform_items}</span> / {r.total_items}
              </div>
            </div>
            {r.score !== null && r.score !== undefined && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Score</div>
                <div className="font-display text-lg text-primary">{r.score}%</div>
              </div>
            )}
            <Badge variant="outline" className={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_LABEL[r.status]}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}