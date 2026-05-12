import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ListChecks, Camera, X, Check, AlertTriangle, MinusCircle, FileSignature, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ANSWER_STATUS_LABEL, ANSWER_STATUS_TONE } from "@/lib/checklists";
import { getMaxVehicleKm, friendlyKmError } from "@/lib/km-validation";
import KmOverrideField from "@/components/dashboard/KmOverrideField";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  runId: string | null;
  onSaved?: () => void;
}

interface Answer {
  id: string;
  question_id: string;
  question_label: string;
  question_category: string | null;
  question_type: string;
  status: string;
  value_text: string | null;
  value_number: number | null;
  value_bool: boolean | null;
  value_choice: string | null;
  photo_urls: string[];
  signature_url: string | null;
  notes: string | null;
  options?: string[];
  required?: boolean;
  require_photo_when_fail?: boolean;
  require_note_when_fail?: boolean;
}

export default function ChecklistRunDialog({ open, onOpenChange, runId, onSaved }: Props) {
  const { currentCompanyId, user, isManager } = useAuth();
  const [run, setRun] = useState<any>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [maxKm, setMaxKm] = useState<number>(0);
  const [kmOverrideReason, setKmOverrideReason] = useState<string>("");

  const load = async () => {
    if (!runId) return;
    setLoading(true);
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("checklist_runs").select("*, vehicle:vehicles(plate,brand,model), template:checklist_templates(name)").eq("id", runId).maybeSingle(),
      supabase.from("checklist_answers").select("*, question:checklist_questions(options,required,require_photo_when_fail,require_note_when_fail)").eq("run_id", runId).order("created_at"),
    ]);
    setRun(r);
    setKmOverrideReason((r as any)?.km_override_reason ?? "");
    if ((r as any)?.vehicle_id) setMaxKm(await getMaxVehicleKm((r as any).vehicle_id));
    setAnswers(
      (a ?? []).map((x: any) => ({
        id: x.id,
        question_id: x.question_id,
        question_label: x.question_label,
        question_category: x.question_category,
        question_type: x.question_type,
        status: x.status,
        value_text: x.value_text,
        value_number: x.value_number,
        value_bool: x.value_bool,
        value_choice: x.value_choice,
        photo_urls: x.photo_urls ?? [],
        signature_url: x.signature_url,
        notes: x.notes,
        options: x.question?.options ?? [],
        required: x.question?.required,
        require_photo_when_fail: x.question?.require_photo_when_fail,
        require_note_when_fail: x.question?.require_note_when_fail,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (open && runId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId]);

  const update = (idx: number, patch: Partial<Answer>) =>
    setAnswers((as) => as.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const onSelectPhoto = async (idx: number, files: FileList | null) => {
    if (!files || !files.length || !currentCompanyId) return;
    setUploadingIdx(idx);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${currentCompanyId}/${runId}/${idx}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("checklist-media").upload(path, file, { upsert: true });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("checklist-media").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    update(idx, { photo_urls: [...answers[idx].photo_urls, ...urls] });
    setUploadingIdx(null);
  };

  const removePhoto = (idx: number, url: string) =>
    update(idx, { photo_urls: answers[idx].photo_urls.filter((u) => u !== url) });

  // Decide o status (conforme/não conforme) com base no valor
  const evalStatus = (a: Answer): string => {
    if (a.status === "nao_aplicavel") return "nao_aplicavel";
    switch (a.question_type) {
      case "sim_nao":
        if (a.value_bool === null) return "pendente";
        return a.value_bool ? "conforme" : "nao_conforme";
      case "multipla_escolha":
        if (!a.value_choice) return "pendente";
        // primeira opção = melhor; outras consideradas alerta — mantemos manual via toggle
        return a.status === "nao_conforme" ? "nao_conforme" : "conforme";
      case "numero":
        if (a.value_number === null) return "pendente";
        return a.status === "nao_conforme" ? "nao_conforme" : "conforme";
      case "texto":
        return a.value_text ? "conforme" : "pendente";
      case "foto":
        return a.photo_urls.length ? "conforme" : "pendente";
      case "assinatura":
        return a.signature_url ? "conforme" : "pendente";
      default:
        return a.status;
    }
  };

  const saveProgress = async (final?: boolean) => {
    if (!runId) return;
    setBusy(true);

    // valida quando finalizando
    if (final) {
      for (const a of answers) {
        const s = evalStatus(a);
        if (a.required && s === "pendente") {
          setBusy(false);
          return toast.error(`Responda: ${a.question_label}`);
        }
        if (s === "nao_conforme") {
          if (a.require_photo_when_fail && a.photo_urls.length === 0) {
            setBusy(false);
            return toast.error(`Foto obrigatória em "${a.question_label}" (item reprovado)`);
          }
          if (a.require_note_when_fail && !a.notes?.trim()) {
            setBusy(false);
            return toast.error(`Observação obrigatória em "${a.question_label}" (item reprovado)`);
          }
        }
      }
    }

    // upsert respostas
    const payload = answers.map((a) => ({
      id: a.id,
      run_id: runId,
      question_id: a.question_id,
      company_id: currentCompanyId,
      question_label: a.question_label,
      question_category: a.question_category,
      question_type: a.question_type as any,
      status: evalStatus(a) as any,
      value_text: a.value_text,
      value_number: a.value_number,
      value_bool: a.value_bool,
      value_choice: a.value_choice,
      photo_urls: a.photo_urls,
      signature_url: a.signature_url,
      notes: a.notes,
      answered_at: new Date().toISOString(),
      answered_by: user?.id,
    }));
    const { error } = await supabase.from("checklist_answers").upsert(payload);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    // recarrega para pegar score atualizado pelo trigger
    const { data: rNow } = await supabase.from("checklist_runs").select("non_conform_items").eq("id", runId).maybeSingle();
    const nonConform = rNow?.non_conform_items ?? 0;

    if (final) {
      const newStatus = nonConform > 0 ? "concluido" : "concluido"; // trigger pode alterar para 'reprovado'
      const { error: rErr } = await supabase
        .from("checklist_runs")
        .update({ status: newStatus, completed_at: new Date().toISOString() })
        .eq("id", runId);
      if (rErr) {
        setBusy(false);
        return toast.error(rErr.message);
      }
      toast.success(nonConform > 0 ? "Checklist finalizado — OS aberta automaticamente" : "Checklist concluído com 100% de conformidade");
    } else {
      await supabase.from("checklist_runs").update({ status: "em_andamento", started_at: run?.started_at ?? new Date().toISOString() }).eq("id", runId);
      toast.success("Progresso salvo");
    }
    setBusy(false);
    onSaved?.();
    if (final) onOpenChange(false);
    else load();
  };

  // Assinatura via canvas
  const sigRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const startDraw = (e: React.PointerEvent) => {
    drawing.current = true;
    const c = sigRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    const r = c.getBoundingClientRect();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const drawMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = sigRef.current!;
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fff";
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
  };
  const endDraw = () => (drawing.current = false);
  const clearSig = (idx: number) => {
    const c = sigRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    update(idx, { signature_url: null });
  };
  const saveSig = async (idx: number) => {
    const c = sigRef.current!;
    if (!currentCompanyId) return;
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    const path = `${currentCompanyId}/${runId}/sig-${idx}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("checklist-media").upload(path, blob, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("checklist-media").getPublicUrl(path);
    update(idx, { signature_url: data.publicUrl });
    toast.success("Assinatura salva");
  };

  const grouped = answers.reduce<Record<string, { idx: number; a: Answer }[]>>((acc, a, idx) => {
    const k = a.question_category ?? "Geral";
    (acc[k] ??= []).push({ idx, a });
    return acc;
  }, {});

  const isFinal = run?.status === "concluido" || run?.status === "reprovado" || run?.status === "cancelado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {run?.template?.name ?? "Checklist"}
            {run?.vehicle?.plate && (
              <Badge variant="outline" className="font-mono">{run.vehicle.plate}</Badge>
            )}
          </DialogTitle>
          {run && (
            <p className="text-xs text-muted-foreground">
              {run.vehicle?.brand} {run.vehicle?.model} ·{" "}
              {run.total_items > 0 && (
                <>Score: <span className="text-primary font-mono">{run.score ?? 0}%</span> · {run.conform_items}/{run.total_items - run.na_items} OK · {run.non_conform_items} reprovados</>
              )}
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {!isFinal && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 surface-card p-3 rounded-lg">
                <div>
                  <Label className="text-xs">KM no momento da inspeção</Label>
                  <Input
                    type="number"
                    value={run?.km_at_check ?? ""}
                    onChange={(e) => setRun({ ...run, km_at_check: e.target.value === "" ? null : Number(e.target.value) })}
                    onBlur={async () => {
                      const k = run.km_at_check;
                      if (k != null && maxKm > 0 && Number(k) < maxKm && !kmOverrideReason.trim()) {
                        toast.error(`KM (${Number(k).toLocaleString("pt-BR")}) é menor que o último registrado (${maxKm.toLocaleString("pt-BR")}). ${isManager ? "Preencha a justificativa de gestor antes de salvar." : "Peça a um gestor para corrigir."}`);
                        return;
                      }
                      if (kmOverrideReason && kmOverrideReason.trim().length < 10) {
                        toast.error("A justificativa do override de KM precisa ter pelo menos 10 caracteres.");
                        return;
                      }
                      const { error } = await supabase.from("checklist_runs").update({
                        km_at_check: k,
                        km_override_reason: kmOverrideReason.trim() || null,
                        km_override_by: kmOverrideReason.trim() ? user?.id : null,
                      }).eq("id", runId!);
                      if (error) toast.error(friendlyKmError(error.message) ?? error.message);
                    }}
                  />
                  <div className="mt-1">
                    <KmOverrideField km={run?.km_at_check} maxKm={maxKm} isManager={isManager}
                      reason={kmOverrideReason} onReasonChange={setKmOverrideReason} context="checklist" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Responsável (assinante)</Label>
                  <Input
                    value={run?.signed_by_name ?? ""}
                    onChange={(e) => setRun({ ...run, signed_by_name: e.target.value })}
                    onBlur={() => supabase.from("checklist_runs").update({ signed_by_name: run.signed_by_name }).eq("id", runId!)}
                    placeholder="Nome de quem está respondendo"
                  />
                </div>
              </div>
            )}

            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="surface-card rounded-lg p-4 space-y-3">
                <h4 className="font-display font-semibold text-sm text-primary">{cat}</h4>
                {items.map(({ idx, a }) => {
                  const status = evalStatus(a);
                  return (
                    <div key={a.id} className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <div className="text-sm font-medium">
                            {a.question_label} {a.required && <span className="text-destructive">*</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className={ANSWER_STATUS_TONE[status]}>{ANSWER_STATUS_LABEL[status]}</Badge>
                      </div>

                      {/* Inputs por tipo */}
                      {a.question_type === "sim_nao" && (
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant={a.value_bool === true ? "default" : "outline"} onClick={() => update(idx, { value_bool: true, status: "conforme" })} disabled={isFinal} className="gap-1">
                            <Check className="h-4 w-4" /> Sim / OK
                          </Button>
                          <Button type="button" size="sm" variant={a.value_bool === false ? "destructive" : "outline"} onClick={() => update(idx, { value_bool: false, status: "nao_conforme" })} disabled={isFinal} className="gap-1">
                            <AlertTriangle className="h-4 w-4" /> Não / Reprovar
                          </Button>
                          <Button type="button" size="sm" variant={a.status === "nao_aplicavel" ? "secondary" : "outline"} onClick={() => update(idx, { status: a.status === "nao_aplicavel" ? "pendente" : "nao_aplicavel", value_bool: null })} disabled={isFinal} className="gap-1">
                            <MinusCircle className="h-4 w-4" /> N/A
                          </Button>
                        </div>
                      )}

                      {a.question_type === "multipla_escolha" && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <Select value={a.value_choice ?? ""} onValueChange={(v) => update(idx, { value_choice: v })} disabled={isFinal}>
                            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {(a.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button type="button" size="sm" variant={a.status === "nao_conforme" ? "destructive" : "outline"} onClick={() => update(idx, { status: a.status === "nao_conforme" ? "conforme" : "nao_conforme" })} disabled={isFinal}>
                            Marcar como reprovado
                          </Button>
                        </div>
                      )}

                      {a.question_type === "numero" && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <Input
                            type="number"
                            className="w-[180px]"
                            value={a.value_number ?? ""}
                            onChange={(e) => update(idx, { value_number: e.target.value === "" ? null : Number(e.target.value) })}
                            disabled={isFinal}
                          />
                          <Button type="button" size="sm" variant={a.status === "nao_conforme" ? "destructive" : "outline"} onClick={() => update(idx, { status: a.status === "nao_conforme" ? "conforme" : "nao_conforme" })} disabled={isFinal}>
                            Marcar como reprovado
                          </Button>
                        </div>
                      )}

                      {a.question_type === "texto" && (
                        <Textarea value={a.value_text ?? ""} onChange={(e) => update(idx, { value_text: e.target.value })} disabled={isFinal} rows={2} />
                      )}

                      {a.question_type === "assinatura" && (
                        <div className="space-y-2">
                          {a.signature_url ? (
                            <div className="flex items-center gap-3">
                              <img src={a.signature_url} alt="assinatura" className="h-20 bg-muted rounded border border-border" />
                              {!isFinal && (
                                <Button type="button" variant="outline" size="sm" onClick={() => update(idx, { signature_url: null })}>Refazer</Button>
                              )}
                            </div>
                          ) : !isFinal ? (
                            <>
                              <canvas
                                ref={sigRef}
                                width={500}
                                height={140}
                                className="border border-border rounded-md bg-background-elevated touch-none w-full max-w-[500px]"
                                onPointerDown={startDraw}
                                onPointerMove={drawMove}
                                onPointerUp={endDraw}
                                onPointerLeave={endDraw}
                              />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => clearSig(idx)}>Limpar</Button>
                                <Button type="button" size="sm" onClick={() => saveSig(idx)} className="gap-1">
                                  <FileSignature className="h-4 w-4" /> Salvar assinatura
                                </Button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Sem assinatura</p>
                          )}
                        </div>
                      )}

                      {/* Fotos (sempre disponível para anexar evidência) */}
                      {(a.question_type === "foto" || a.photo_urls.length > 0 || status === "nao_conforme") && (
                        <div className="space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            {a.photo_urls.map((url) => (
                              <div key={url} className="relative">
                                <img src={url} alt="" className="h-20 w-20 object-cover rounded border border-border" />
                                {!isFinal && (
                                  <button type="button" onClick={() => removePhoto(idx, url)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {!isFinal && (
                              <label className="h-20 w-20 grid place-items-center border border-dashed border-border rounded cursor-pointer hover:bg-muted/40 text-muted-foreground">
                                {uploadingIdx === idx ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => onSelectPhoto(idx, e.target.files)} />
                              </label>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Observação */}
                      {(status === "nao_conforme" || a.notes) && (
                        <div>
                          <Label className="text-xs">Observação {a.require_note_when_fail && status === "nao_conforme" && <span className="text-destructive">*</span>}</Label>
                          <Textarea value={a.notes ?? ""} onChange={(e) => update(idx, { notes: e.target.value })} rows={2} disabled={isFinal} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {!isFinal && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => saveProgress(false)} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar progresso
            </Button>
            <Button onClick={() => saveProgress(true)} disabled={busy} className="bg-gradient-primary text-primary-foreground gap-2">
              <CheckCircle2 className="h-4 w-4" /> Finalizar checklist
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}