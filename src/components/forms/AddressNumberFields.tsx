import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

type Props = {
  number: string;
  complement: string;
  onNumberChange: (v: string) => void;
  onComplementChange: (v: string) => void;
  /** Mostra aviso amarelo (registro antigo sem número). */
  warnLegacy?: boolean;
  required?: boolean;
  className?: string;
};

/**
 * Par "Número + Complemento" para usar logo após o endereço (rua/bairro).
 * Aceita ref para o input de número (foco automático após CEP).
 */
const AddressNumberFields = forwardRef<HTMLInputElement, Props>(function AddressNumberFields(
  { number, complement, onNumberChange, onComplementChange, warnLegacy, required = true, className },
  ref,
) {
  return (
    <div className={"contents " + (className ?? "")}>
      <div className="space-y-2">
        <Label>Número {required && "*"}</Label>
        <Input
          ref={ref}
          value={number || ""}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="Ex: 1578, s/n, 100-A"
          maxLength={20}
        />
      </div>
      <div className="space-y-2">
        <Label>Complemento</Label>
        <Input
          value={complement || ""}
          onChange={(e) => onComplementChange(e.target.value)}
          placeholder="Apto, sala, bloco"
          maxLength={60}
        />
      </div>
      {warnLegacy && (
        <div className="sm:col-span-2 md:col-span-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Cadastro sem número — recomendamos atualizar.
        </div>
      )}
    </div>
  );
});

export default AddressNumberFields;
