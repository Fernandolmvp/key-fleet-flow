import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/document";

export type CnpjLookupResult = {
  legalName?: string | null;
  tradeName?: string | null;
  email?: string | null;
  phone?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cnaeCode?: string | null;
  simplesNacional?: boolean | null;
  status?: string | null;
  raw?: any;
};

type Props = {
  documentType: "cnpj" | "cpf";
  onDocumentTypeChange?: (t: "cnpj" | "cpf") => void;
  value: string;
  onChange: (v: string) => void;
  onLookup?: (r: CnpjLookupResult) => void;
  verified?: boolean;
  allowCpf?: boolean;
  label?: string;
};

export default function CnpjLookupInput({
  documentType, onDocumentTypeChange, value, onChange, onLookup, verified, allowCpf = true, label = "CNPJ / CPF",
}: Props) {
  const [busy, setBusy] = useState(false);
  const digits = onlyDigits(value);
  const isValid = documentType === "cnpj" ? isValidCnpj(digits) : isValidCpf(digits);
  const showError = digits.length > 0 && ((documentType === "cnpj" && digits.length === 14) || (documentType === "cpf" && digits.length === 11)) && !isValid;

  const lookup = async () => {
    if (documentType !== "cnpj") return toast.error("Consulta disponível somente para CNPJ");
    if (!isValidCnpj(digits)) return toast.error("CNPJ inválido");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cnpj-lookup", { body: { cnpj: digits } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na consulta");
      onLookup?.(data.result as CnpjLookupResult);
      toast.success("Dados encontrados na Receita");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar Receita");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {allowCpf && (
          <div className="inline-flex rounded border border-border overflow-hidden text-[10px]">
            {(["cnpj", "cpf"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onDocumentTypeChange?.(t)}
                className={`px-2 py-0.5 uppercase font-mono ${documentType === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            inputMode="numeric"
            placeholder={documentType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
            value={documentType === "cnpj" ? formatCnpj(value || "") : formatCpf(value || "")}
            onChange={(e) => onChange(onlyDigits(e.target.value))}
            className="pr-9"
          />
          {verified && !showError && (
            <Check className="h-4 w-4 text-success absolute right-2 top-1/2 -translate-y-1/2" />
          )}
          {showError && (
            <AlertTriangle className="h-4 w-4 text-destructive absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>
        {documentType === "cnpj" && (
          <Button type="button" variant="outline" size="sm" onClick={lookup} disabled={busy || !isValidCnpj(digits)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Buscar Receita</span>
          </Button>
        )}
      </div>
      {showError && <p className="text-xs text-destructive">Documento inválido — verifique os dígitos.</p>}
    </div>
  );
}