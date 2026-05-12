import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface Props {
  km: number | null | undefined;
  maxKm: number;
  isManager: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  /** Optional context label, e.g. "abastecimento" or "manutenção" */
  context?: string;
}

/**
 * Inline visual feedback for KM validation:
 * - shows nothing if KM is empty or valid
 * - red error if KM < maxKm (and offers override UI for managers)
 * - amber warning if KM jump > 50.000 km (does not block)
 */
export default function KmOverrideField({ km, maxKm, isManager, reason, onReasonChange, context }: Props) {
  const [showOverride, setShowOverride] = useState(!!reason);
  useEffect(() => { if (reason) setShowOverride(true); }, [reason]);

  const k = Number(km);
  if (!k || isNaN(k) || maxKm === 0) return null;

  const regressive = k < maxKm;
  const bigJump = !regressive && k - maxKm > 50000;

  if (!regressive && !bigJump) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Último KM registrado: {maxKm.toLocaleString("pt-BR")}.
      </p>
    );
  }

  if (bigJump) {
    return (
      <div className="flex items-start gap-2 text-xs rounded-md border border-warning/40 bg-warning/10 text-warning px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          Diferença de <strong>{(k - maxKm).toLocaleString("pt-BR")} km</strong> em relação ao último registro ({maxKm.toLocaleString("pt-BR")}). Confirme o hodômetro antes de salvar.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
      <div className="flex items-start gap-2 text-xs text-destructive">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          KM informado (<strong>{k.toLocaleString("pt-BR")}</strong>) é menor que o último KM do veículo (<strong>{maxKm.toLocaleString("pt-BR")}</strong>).{" "}
          {isManager
            ? "Para registrar mesmo assim, justifique abaixo."
            : "Apenas um gestor pode corrigir com justificativa."}
        </div>
      </div>
      {isManager && (
        showOverride ? (
          <div className="space-y-1">
            <Label className="text-[11px]">Justificativa do gestor (mín. 10 caracteres) *</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={`Ex.: hodômetro trocado em oficina; correção de erro de digitação no ${context ?? "registro"} anterior...`}
              className="text-xs"
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setShowOverride(true)}>
            Sobrescrever KM (gestor)
          </Button>
        )
      )}
    </div>
  );
}