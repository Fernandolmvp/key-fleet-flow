import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, GripVertical, ListChecks, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FREQUENCIES, QUESTION_TYPES, DEFAULT_MONTHLY_TEMPLATE } from "@/lib/checklists";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  templateId?: string | null;
  onSaved?: () => void;
}

interface QRow {
  id?: string;
  category: string;
  label: string;
  help_text?: string;
  question_type: string;
  options: string[];
  required: boolean;
  require_photo_when_fail: boolean;
  require_note_when_fail: boolean;
  min_value?: number | null;
  max_value?: number | null;
  sort_order: number;
}

const newQuestion = (sort_order: number): QRow => ({
  category: "Geral",
  label: "",
  question_type: "sim_nao",
  options: [],
  required: true,
  require_photo_when_fail: true,
  require_note_when_fail: true,
  sort_order,
});

export default function ChecklistTemplateBuilder({ open, onOpenChange, templateId, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<string>("mensal");
  const [autoOpenOs, setAutoOpenOs] = useState(true);
  const [active, setActive] = useState(true);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (templateId) {
      (async () => {
        setLoading(true);
        const [{ data: t }, { data: qs }] = await Promise.all([
          supabase.from("checklist_templates").select("*").eq("id", templateId).maybeSingle(),
          supabase.from("checklist_questions").select("*").eq("template_id", templateId).order("sort_order"),
        ]);
        if (t) {
          setName(t.name);
          setDescription(t.description ?? "");
          setFrequency(t.frequency);
          setAutoOpenOs(t.auto_open_os);
          setActive(t.active);
        }
        setQuestions(
          (qs ?? []).map((q: any, i: number) => ({
            id: q.id,
            category: q.category ?? "Geral",
            label: q.label,
            help_text: q.help_text ?? "",
            question_type: q.question_type,
            options: Array.isArray(q.options) ? q.options : [],
            required: q.required,
            require_photo_when_fail: q.require_photo_when_fail,
            require_note_when_fail: q.require_note_when_fail,
            min_value: q.min_value,
            max_value: q.max_value,
            sort_order: q.sort_order ?? i,
          })),
        );
        setLoading(false);
      })();
    } else {
      setName("");
      setDescription("");
      setFrequency("mensal");
      setAutoOpenOs(true);
      setActive(true);
      setQuestions([newQuestion(0)]);
    }
  }, [open, templateId]);

  const addQuestion = () => setQuestions((qs) => [...qs, newQuestion(qs.length)]);
  const removeQuestion = (idx: number) =>
    setQuestions((qs) => qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, sort_order: i })));
  const updateQuestion = (idx: number, patch: Partial<QRow>) =>
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  const moveQuestion = (idx: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((q, i) => ({ ...q, sort_order: i }));
    });

  const loadDefault = () => {
    setName(DEFAULT_MONTHLY_TEMPLATE.name);
    setDescription(DEFAULT_MONTHLY_TEMPLATE.description);
    setFrequency(DEFAULT_MONTHLY_TEMPLATE.frequency);
    setAutoOpenOs(DEFAULT_MONTHLY_TEMPLATE.auto_open_os);
    setQuestions(
      DEFAULT_MONTHLY_TEMPLATE.questions.map((q, i) => ({
        category: q.category,
        label: q.label,
        question_type: q.question_type,
        options: (q as any).options ?? [],
        required: (q as any).required ?? true,
        require_photo_when_fail: true,
        require_note_when_fail: true,
        min_value: (q as any).min_value ?? null,
        max_value: (q as any).max_value ?? null,
        sort_order: i,
      })),
    );
    toast.success("Modelo padrão carregado");
  };

  const save = async () => {
    if (!currentCompanyId) return;
    if (!name.trim()) return toast.error("Informe o nome do modelo");
    if (questions.length === 0) return toast.error("Adicione ao menos uma pergunta");
    if (questions.some((q) => !q.label.trim())) return toast.error("Há perguntas sem rótulo");
    setBusy(true);
    let tplId = templateId;
    if (tplId) {
      const { error } = await supabase
        .from("checklist_templates")
        .update({ name, description, frequency: frequency as any, auto_open_os: autoOpenOs, active })
        .eq("id", tplId);
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
      await supabase.from("checklist_questions").delete().eq("template_id", tplId);
    } else {
      const { data, error } = await supabase
        .from("checklist_templates")
        .insert({
          company_id: currentCompanyId,
          name,
          description,
          frequency: frequency as any,
          auto_open_os: autoOpenOs,
          active,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        return toast.error(error?.message ?? "Falha ao criar modelo");
      }
      tplId = data.id;
    }
    const payload = questions.map((q, i) => ({
      template_id: tplId!,
      company_id: currentCompanyId,
      category: q.category || null,
      label: q.label,
      help_text: q.help_text || null,
      question_type: q.question_type as any,
      options: q.options ?? [],
      required: q.required,
      require_photo_when_fail: q.require_photo_when_fail,
      require_note_when_fail: q.require_note_when_fail,
      min_value: q.min_value ?? null,
      max_value: q.max_value ?? null,
      sort_order: i,
    }));
    const { error: qErr } = await supabase.from("checklist_questions").insert(payload);
    setBusy(false);
    if (qErr) return toast.error(qErr.message);
    toast.success("Modelo salvo");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {templateId ? "Editar modelo de checklist" : "Novo modelo de checklist"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {!templateId && (
              <Button type="button" variant="outline" size="sm" onClick={loadDefault} className="gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Carregar modelo padrão (preventiva mensal)
              </Button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 surface-card p-4 rounded-lg">
              <div className="md:col-span-2">
                <Label>Nome do modelo *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Inspeção Mensal Preventiva" />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Frequência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3">
                <div>
                  <div className="text-sm font-medium">Abrir OS automaticamente</div>
                  <div className="text-xs text-muted-foreground">Itens não conformes geram OS de manutenção</div>
                </div>
                <Switch checked={autoOpenOs} onCheckedChange={setAutoOpenOs} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3">
                <div>
                  <div className="text-sm font-medium">Modelo ativo</div>
                  <div className="text-xs text-muted-foreground">Disponível para novas execuções</div>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold">Perguntas <Badge variant="outline" className="ml-2">{questions.length}</Badge></h4>
              <Button type="button" size="sm" onClick={addQuestion} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar pergunta
              </Button>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={idx} className="surface-card rounded-lg p-4 space-y-3 border border-border">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <button type="button" onClick={() => moveQuestion(idx, -1)} className="text-muted-foreground hover:text-primary text-xs">▲</button>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <button type="button" onClick={() => moveQuestion(idx, 1)} className="text-muted-foreground hover:text-primary text-xs">▼</button>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <Label className="text-xs">Categoria</Label>
                        <Input value={q.category} onChange={(e) => updateQuestion(idx, { category: e.target.value })} placeholder="Geral" />
                      </div>
                      <div className="md:col-span-6">
                        <Label className="text-xs">Pergunta *</Label>
                        <Input value={q.label} onChange={(e) => updateQuestion(idx, { label: e.target.value })} placeholder="Ex: Nível do óleo está adequado?" />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs">Tipo de resposta</Label>
                        <Select value={q.question_type} onValueChange={(v) => updateQuestion(idx, { question_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {q.question_type === "multipla_escolha" && (
                        <div className="md:col-span-12">
                          <Label className="text-xs">Opções (separadas por vírgula)</Label>
                          <Input
                            value={q.options.join(", ")}
                            onChange={(e) => updateQuestion(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                            placeholder="Bom, Médio, Trocar"
                          />
                        </div>
                      )}
                      {q.question_type === "numero" && (
                        <>
                          <div className="md:col-span-3">
                            <Label className="text-xs">Mín.</Label>
                            <Input type="number" value={q.min_value ?? ""} onChange={(e) => updateQuestion(idx, { min_value: e.target.value === "" ? null : Number(e.target.value) })} />
                          </div>
                          <div className="md:col-span-3">
                            <Label className="text-xs">Máx.</Label>
                            <Input type="number" value={q.max_value ?? ""} onChange={(e) => updateQuestion(idx, { max_value: e.target.value === "" ? null : Number(e.target.value) })} />
                          </div>
                        </>
                      )}

                      <div className="md:col-span-12 flex flex-wrap gap-4 pt-1">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch checked={q.required} onCheckedChange={(v) => updateQuestion(idx, { required: v })} /> Obrigatória
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Switch checked={q.require_photo_when_fail} onCheckedChange={(v) => updateQuestion(idx, { require_photo_when_fail: v })} /> Exigir foto se reprovar
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Switch checked={q.require_note_when_fail} onCheckedChange={(v) => updateQuestion(idx, { require_note_when_fail: v })} /> Exigir observação se reprovar
                        </label>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(idx)} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy} className="bg-gradient-primary text-primary-foreground">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}