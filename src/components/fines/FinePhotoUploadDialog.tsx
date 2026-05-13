import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import FineFormDialog from "./FineFormDialog";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type Props = { open: boolean; onClose: () => void; companyId: string; onSaved: () => void };

export default function FinePhotoUploadDialog({ open, onClose, companyId, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<any | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const reset = () => { setFile(null); setExtracted(null); setPhotoUrl(null); setLoading(false); };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-traffic-fine", {
        body: { fileBase64: base64, mimeType: file.type || "image/jpeg" },
      });
      if (error) {
        let msg = error.message || "Falha na IA";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      // Upload do arquivo
      try {
        const path = `${companyId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("fines-attachments").upload(path, file, { contentType: file.type, upsert: false });
        if (!upErr) {
          const { data: signed } = await supabase.storage.from("fines-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
          setPhotoUrl(signed?.signedUrl ?? null);
        }
      } catch (e) { console.warn("upload falhou", e); }

      setExtracted(data.data);
    } catch (e: any) {
      toast({ title: "Erro na análise por IA", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (extracted) {
    return (
      <FineFormDialog
        open={open}
        onClose={() => { reset(); onClose(); }}
        companyId={companyId}
        initialData={extracted}
        initialPhotoUrl={photoUrl}
        aiConfidence={extracted?.confianca_extracao ?? null}
        onSaved={() => { reset(); onSaved(); }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Cadastrar via foto (IA)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie a foto do <strong>aviso</strong> ou da <strong>notificação oficial</strong> de infração.
            A IA identifica o tipo e preenche os campos automaticamente.
          </p>
          <div className="space-y-2">
            <Label>Arquivo (imagem ou PDF)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {file && (
            <p className="text-xs text-muted-foreground truncate">📎 {file.name}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleAnalyze} disabled={!file || loading} className="gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> IA analisando…</> : <><Upload className="h-4 w-4" /> Analisar com IA</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}