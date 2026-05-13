import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCepLookup, formatCep, type ViaCepResult } from "@/hooks/useCepLookup";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
};

type Props = {
  value: string;
  onChange: (cep: string) => void;
  onAddressFound?: (a: CepAddress) => void;
  nextFieldRef?: React.RefObject<HTMLInputElement>;
  label?: string;
  className?: string;
  id?: string;
};

export default function CepInput({ value, onChange, onAddressFound, nextFieldRef, label = "CEP", className, id }: Props) {
  const { loading, error, lookup } = useCepLookup();
  const [success, setSuccess] = useState(false);
  const lastQueriedRef = useRef<string>("");

  useEffect(() => {
    const digits = (value || "").replace(/\D/g, "");
    if (digits.length !== 8) {
      setSuccess(false);
      return;
    }
    if (digits === lastQueriedRef.current) return;
    const t = setTimeout(async () => {
      lastQueriedRef.current = digits;
      const r: ViaCepResult | null = await lookup(digits);
      if (r) {
        setSuccess(true);
        onAddressFound?.({
          cep: r.cep,
          street: r.logradouro || "",
          neighborhood: r.bairro || "",
          city: r.localidade || "",
          uf: r.uf || "",
        });
        toast.success("Endereço encontrado");
        setTimeout(() => nextFieldRef?.current?.focus(), 50);
      } else {
        setSuccess(false);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const showError = !loading && !!error && (value || "").replace(/\D/g, "").length === 8;

  return (
    <div className={"space-y-2 " + (className ?? "")}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          placeholder="00000-000"
          maxLength={9}
          value={formatCep(value || "")}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className="pr-9"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
          {!loading && success && <Check className="h-4 w-4 text-success" />}
          {showError && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <X className="h-4 w-4 text-destructive cursor-help" />
                </TooltipTrigger>
                <TooltipContent>{error}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      {showError && <p className="text-xs text-destructive">{error} — preencha manualmente.</p>}
    </div>
  );
}
