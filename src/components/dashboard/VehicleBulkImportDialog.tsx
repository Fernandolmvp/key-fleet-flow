import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FolderOpen, Loader2, CheckCircle2, AlertTriangle, X, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { extractDocument } from "@/lib/ai-extract";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type RowStatus = "pending" | "extracting" | "saving" | "ok" | "error" | "duplicate" | "skipped";

interface Row {
  file: File;
  status: RowStatus;
  message?: string;
  plate?: string;
  brand?: string;
  model?: string;
  vehicleId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported?: () => void;
}

export default function VehicleBulkImportDialog({ open, onOpenChange, onImported }: Props) {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((f) =>
      f.type.startsWith("image/") || f.type === "application/pdf" || /\.(pdf|jpg|jpeg|png|webp|heic)$/i.test(f.name),
    );
    if (accepted.length === 0) return toast.error("Nenhum arquivo PDF/imagem encontrado");
    setRows((prev) => [
      ...prev,
      ...accepted.map<Row>((f) => ({ file: f, status: "pending" })),
    ]);
  };

  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const runImport = async () => {
    if (!currentCompanyId) return toast.error("Selecione uma empresa");
    if (rows.length === 0) return toast.error("Adicione arquivos");
    setRunning(true);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "ok" || row.status === "skipped" || row.status === "duplicate") continue;
      // mark extracting
      setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, status: "extracting", message: undefined } : r)));
      try {
        const { data, archivedUrl } = await extractDocument({
          type: "vehicle",
          file: row.file,
          bucket: "vehicle-docs",
          companyId: currentCompanyId,
        });

        const plate = data.plate ? String(data.plate).toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
        if (!plate) {
          setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, status: "error", message: "Placa não identificada" } : r)));
          errorCount++;
          continue;
        }

        // Check duplicate by plate within company
        const { data: existing } = await supabase
          .from("vehicles")
          .select("id, plate")
          .eq("company_id", currentCompanyId)
          .eq("plate", plate)
          .maybeSingle();

        if (existing) {
          setRows((rs) =>
            rs.map((r, idx) =>
              idx === i ? { ...r, status: "duplicate", message: `Já existe (${plate})`, plate, brand: data.brand, model: data.model, vehicleId: existing.id } : r,
            ),
          );
          continue;
        }

        setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, status: "saving", plate, brand: data.brand, model: data.model } : r)));

        const insertPayload: any = {
          company_id: currentCompanyId,
          plate,
          renavam: data.renavam ?? null,
          chassis: data.chassis ?? null,
          brand: (data.brand || "—").toString().trim(),
          model: (data.model || "—").toString().trim(),
          year_manufacture: data.year_manufacture ? Number(data.year_manufacture) : null,
          year_model: data.year_model ? Number(data.year_model) : null,
          color: data.color ?? null,
          fuel_type: data.fuel_type ?? null,
          vehicle_type: data.vehicle_type ?? null,
          owner_name: data.owner_name ?? null,
          owner_doc: data.owner_doc ? String(data.owner_doc).replace(/\D/g, "") : null,
          crlv_city: data.crlv_city ?? null,
          crlv_issue_date: data.crlv_issue_date ?? null,
          licensing_year: data.licensing_year ? Number(data.licensing_year) : null,
          documents: archivedUrl ? [archivedUrl] : [],
          photos: [],
          status: "ativo",
          current_km: 0,
        };

        const { data: created, error: insErr } = await supabase
          .from("vehicles")
          .insert(insertPayload)
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);

        // Vincula CRLV em documents
        if (archivedUrl && created?.id) {
          await supabase.from("documents").insert({
            company_id: currentCompanyId,
            entity_type: "vehicle",
            entity_id: created.id,
            doc_type: "crlv",
            title: "CRLV",
            issue_date: data.crlv_issue_date || null,
            file_url: archivedUrl,
            file_name: archivedUrl.split("/").pop() || null,
            mime_type: archivedUrl.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
            ai_extracted: {
              source: "vehicle_bulk_import",
              plate,
              owner_name: data.owner_name,
              owner_doc: data.owner_doc,
              crlv_city: data.crlv_city,
              licensing_year: data.licensing_year,
              crlv_issue_date: data.crlv_issue_date,
            },
          });
        }

        setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, status: "ok", vehicleId: created?.id } : r)));
        successCount++;
      } catch (e: any) {
        setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, status: "error", message: e?.message || "Falha" } : r)));
        errorCount++;
      }
    }

    setRunning(false);
    if (successCount > 0) {
      toast.success(`${successCount} veículo(s) importado(s)`);
      onImported?.();
    }
    if (errorCount > 0) toast.error(`${errorCount} arquivo(s) com erro`);
  };

  const reset = () => setRows([]);

  const statusBadge = (s: RowStatus) => {
    switch (s) {
      case "pending":
        return <Badge variant="outline" className="text-[10px]">Aguardando</Badge>;
      case "extracting":
        return <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Extraindo</Badge>;
      case "saving":
        return <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Salvando</Badge>;
      case "ok":
        return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Importado</Badge>;
      case "duplicate":
        return <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Duplicado</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Erro</Badge>;
      default:
        return null;
    }
  };

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Importar veículos em lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Selecione vários CRLVs (PDF ou imagem) ou uma pasta inteira. A IA extrai os dados de cada documento e cria 1 veículo por arquivo. Placas duplicadas são ignoradas automaticamente.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => filesRef.current?.click()} disabled={running}>
              <Upload className="h-4 w-4 mr-1" /> Adicionar arquivos
            </Button>
            <Button variant="outline" onClick={() => folderRef.current?.click()} disabled={running}>
              <FolderOpen className="h-4 w-4 mr-1" /> Selecionar pasta
            </Button>
            {rows.length > 0 && !running && (
              <Button variant="ghost" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Limpar lista
              </Button>
            )}
            <input
              ref={filesRef}
              type="file"
              multiple
              accept="application/pdf,image/*"
              hidden
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
            />
            <input
              ref={folderRef}
              type="file"
              hidden
              multiple
              // @ts-ignore — atributos de seleção de pasta
              webkitdirectory=""
              directory=""
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
            />
          </div>

          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="outline">Total: {rows.length}</Badge>
              {counts.ok > 0 && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">OK: {counts.ok}</Badge>}
              {counts.duplicate > 0 && <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">Duplicados: {counts.duplicate}</Badge>}
              {counts.error > 0 && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Erros: {counts.error}</Badge>}
            </div>
          )}

          <div className="space-y-1 max-h-[420px] overflow-y-auto rounded-lg border border-border p-2">
            {rows.length === 0 && (
              <div className="text-sm text-muted-foreground py-10 text-center">
                Nenhum arquivo selecionado. Use os botões acima.
              </div>
            )}
            {rows.map((r, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-muted/10">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{r.file.name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      {r.plate && <span className="font-mono font-bold text-primary">{r.plate}</span>}
                      {r.brand && <span>{r.brand} {r.model || ""}</span>}
                      {r.message && <span className="text-destructive">{r.message}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(r.status)}
                  {!running && r.status !== "ok" && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Fechar
          </Button>
          <Button onClick={runImport} disabled={running || rows.length === 0}>
            {running ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando...</> : <><Sparkles className="h-4 w-4 mr-1" /> Importar com IA</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}