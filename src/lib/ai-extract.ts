import { supabase } from "@/integrations/supabase/client";

export type DocType = "vehicle" | "driver" | "plate" | "odometer" | "maintenance_invoice" | "tire_invoice" | "document" | "fuel_receipt";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Envia o arquivo para IA extrair dados estruturados E arquiva no bucket informado.
 * Retorna { data, archivedUrl }.
 */
export async function extractDocument(opts: {
  type: DocType;
  file: File;
  bucket?: string;
  companyId?: string;
}): Promise<{ data: Record<string, any>; archivedUrl: string | null }> {
  const { type, file, bucket, companyId } = opts;

  // Roda IA e arquivamento EM PARALELO para não travar o spinner.
  const aiPromise = (async () => {
    const base64 = await fileToBase64(file);
    return supabase.functions.invoke("extract-document", {
      body: { type, fileBase64: base64, mimeType: file.type || "application/octet-stream" },
    });
  })();

  const archivePromise: Promise<string | null> = (async () => {
    if (!bucket || !companyId) return null;
    try {
      const path = `${companyId}/${type}/${crypto.randomUUID()}-${file.name}`;
      // Timeout duro de 45s para não deixar o botão travado em "lendo".
      const upload = supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      const timeout = new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("upload timeout") }), 45_000)
      );
      const { error: upErr } = (await Promise.race([upload, timeout])) as any;
      if (upErr) return null;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      return pub.publicUrl ?? null;
    } catch (e) {
      console.warn("archive failed", e);
      return null;
    }
  })();

  const [{ data: result, error }, archivedUrl] = await Promise.all([aiPromise, archivePromise]);

  if (error) {
    // Tenta extrair a mensagem real do corpo da resposta (FunctionsHttpError esconde 4xx/5xx)
    let msg = error.message || "Falha ao processar documento";
    try {
      const ctx: any = (error as any).context;
      if (ctx?.json) {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      } else if (ctx?.text) {
        const txt = await ctx.text();
        try { const j = JSON.parse(txt); if (j?.error) msg = j.error; } catch { /* keep msg */ }
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (result?.error) throw new Error(result.error);
  if (!result?.data) throw new Error("Sem dados extraídos");

  return { data: result.data as Record<string, any>, archivedUrl };
}