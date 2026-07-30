import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function openInNewTab(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Parses a Supabase Storage URL (public, sign, or authenticated) and returns
 * { bucket, path } when possible. Returns null for non-storage URLs.
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2].split("?")[0]) };
  } catch {
    return null;
  }
}

/**
 * Resolve a stored file URL into something the browser can open.
 * - If it's a Supabase Storage URL, returns a fresh signed URL (works for private buckets).
 * - Otherwise, returns the URL unchanged.
 */
export async function resolveStoredFileUrl(
  url: string | null | undefined,
  expiresIn = 60 * 60,
  fallbackBucket?: string,
): Promise<string | null> {
  if (!url) return null;
  let parsed = parseStorageUrl(url);
  if (!parsed) {
    // Valor pode ser apenas o path dentro de um bucket conhecido
    if (!/^https?:\/\//i.test(url) && fallbackBucket) {
      parsed = { bucket: fallbackBucket, path: url.replace(/^\/+/, "") };
    } else {
      return url;
    }
  }
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresIn);
  if (error || !data?.signedUrl) {
    console.warn("[storage] createSignedUrl failed", parsed.bucket, parsed.path, error?.message);
    return null;
  }
  return data.signedUrl;
}

/** Open a stored file URL in a new tab, signing it first if it's in Supabase Storage. */
export async function openStoredFile(
  url: string | null | undefined,
  opts?: { hash?: string; bucket?: string },
): Promise<void> {
  const signed = await resolveStoredFileUrl(url, 60 * 60, opts?.bucket);
  if (!signed) {
    toast.error("Não foi possível abrir o arquivo. Verifique se o PDF ainda existe no armazenamento.");
    return;
  }
  openInNewTab(opts?.hash ? `${signed}${opts.hash}` : signed);
}