import { useEffect, useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const STORED_FILE_VIEW_EVENT = "frotaops:open-stored-file";

type ViewerDetail = { url: string; filename?: string };

type ViewerFile = { url: string; filename: string };

export default function StoredFileViewer() {
  const [file, setFile] = useState<ViewerFile | null>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<ViewerDetail>).detail;
      if (!detail?.url) return;
      setFile((current) => {
        if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url.split("#")[0]);
        return { url: detail.url, filename: detail.filename || "documento.pdf" };
      });
    };
    window.addEventListener(STORED_FILE_VIEW_EVENT, open);
    return () => window.removeEventListener(STORED_FILE_VIEW_EVENT, open);
  }, []);

  const close = () => {
    setFile((current) => {
      if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url.split("#")[0]);
      return null;
    });
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Visualizador de documento">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
           <span className="truncate">{file.filename}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild size="icon" variant="ghost" title="Baixar documento">
             <a href={file.url.split("#")[0]} download={file.filename}>
              <Download className="h-4 w-4" />
              <span className="sr-only">Baixar documento</span>
            </a>
          </Button>
           <Button size="icon" variant="ghost" onClick={close} title="Fechar documento">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar documento</span>
          </Button>
        </div>
      </header>
       <iframe src={file.url} title={file.filename} className="min-h-0 flex-1 w-full bg-muted" />
    </div>
  );
}