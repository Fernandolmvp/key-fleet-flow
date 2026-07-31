import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Download, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export const STORED_FILE_VIEW_EVENT = "frotaops:open-stored-file";

type ViewerDetail = { url: string; filename?: string };

type ViewerFile = { url: string; filename: string };

export default function StoredFileViewer() {
  const [file, setFile] = useState<ViewerFile | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<ViewerDetail>).detail;
      if (!detail?.url) return;
      setFile((current) => {
        if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url.split("#")[0]);
        return { url: detail.url, filename: detail.filename || "documento.pdf" };
      });
      setPageCount(0);
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
       <main className="min-h-0 flex-1 overflow-auto bg-muted p-3 sm:p-6">
         <Document
           file={file.url.split("#")[0]}
           onLoadSuccess={({ numPages }) => setPageCount(numPages)}
           loading={<div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
           error={<div className="grid min-h-64 place-items-center text-sm text-destructive">Não foi possível renderizar este PDF.</div>}
           className="mx-auto flex w-fit max-w-full flex-col gap-4"
         >
           {Array.from({ length: pageCount }, (_, index) => (
             <Page
               key={index + 1}
               pageNumber={index + 1}
               width={Math.min(960, Math.max(280, window.innerWidth - 48))}
               renderAnnotationLayer
               renderTextLayer
               className="max-w-full overflow-hidden shadow-sm"
             />
           ))}
         </Document>
       </main>
    </div>
  );
}