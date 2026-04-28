import { supabase } from "@/integrations/supabase/client";

export type DocType = "vehicle" | "driver";

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
  bucket: string;
  companyId: string;
}): Promise<{ data: Record<string, any>; archivedUrl: string | null }> {
  const { type, file, bucket, companyId } = opts;
  const base64 = await fileToBase64(file);

  // 1) Extrair via edge function
  const { data: result, error } = await supabase.functions.invoke("extract-document", {
    body: { type, fileBase64: base64, mimeType: file.type || "application/octet-stream" },
  });
  if (error) throw new Error(error.message);
  if (!result?.data) throw new Error("Sem dados extraídos");

  // 2) Arquivar arquivo
  let archivedUrl: string | null = null;
  try {
    const path = `${companyId}/${type}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (!upErr) {
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      archivedUrl = pub.publicUrl;
    }
  } catch (e) {
    console.warn("archive failed", e);
  }

  return { data: result.data as Record<string, any>, archivedUrl };
}