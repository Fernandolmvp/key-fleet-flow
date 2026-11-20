import { CircleDot } from "lucide-react";
import { tireStatus, TireStatusInput } from "@/lib/tire-status";
import { cn } from "@/lib/utils";

interface Props {
  positions: string[];
  installed: Record<string, TireStatusInput & { id: string; brand: string; size: string; serial?: string | null; last_pressure_psi?: number | null; target_pressure_psi?: number | null; tread?: number | null }>;
  selected?: string | null;
  onSelect?: (pos: string) => void;
}

/** Mapa simples de posições agrupadas por eixo (códigos como DD/DE/1DD/etc.). */
export default function TireAxleMap({ positions, installed, selected, onSelect }: Props) {
  // Group by axle prefix (everything except last 2 chars), or by single character group.
  const groups: Record<string, string[]> = {};
  positions.forEach((p) => {
    const [unit, code] = p.includes("-") ? p.split("-") : ["", p];
    const axle = code === "EST" ? "Estepe" : /^\d/.test(code) ? code.match(/^\d+/)![0]
      : ["DI", "DD", "DE"].includes(code) ? "Dianteiro"
      : ["TR", "TD", "TE", "TDD", "TDE"].includes(code) ? "Traseiro"
      : ["TTD", "TTE"].includes(code) ? "Traseiro 2" : code;
    const key = unit ? `${unit} · ${axle}` : axle;
    (groups[key] ||= []).push(p);
  });

  if (positions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
        Defina o layout de eixos para visualizar as posições.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([axle, pos]) => (
        <div key={axle} className="surface-card rounded-lg p-3">
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Eixo {axle}</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {pos.map((p) => {
              const tire = installed[p];
              const isSel = selected === p;
              const status = tire ? tireStatus(tire) : null;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelect?.(p)}
                  className={cn(
                    "min-w-[88px] rounded-md border px-2 py-2 text-left transition-all",
                    tire
                      ? status?.level === "critico" ? "border-destructive/40 bg-destructive/10" : status?.level === "atencao" ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10"
                      : "border-dashed border-border bg-muted/20 hover:bg-muted/40",
                    isSel && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center gap-1 text-xs font-mono text-primary">
                    <CircleDot className="h-3 w-3" /> {p}
                  </div>
                  {tire ? (
                    <div className="mt-1">
                      <div className="text-[11px] font-medium truncate">{tire.serial ?? "Sem serial"}</div>
                      <div className="text-[10px] text-muted-foreground">{tire.brand}</div>
                      <div className="text-[10px] text-muted-foreground">{tire.size}</div>
                      <div className="text-[10px] font-mono">Sulco: {tire.tread ?? "—"} mm</div>
                      <div className="text-[10px] font-mono">Pressão: {tire.last_pressure_psi ?? "—"} PSI</div>
                      <div className="text-[10px] text-muted-foreground">Alvo: {tire.target_pressure_psi ?? "—"} PSI</div>
                      <div className="text-[10px]">Medição: {tire.last_measured_at ? new Date(tire.last_measured_at).toLocaleString("pt-BR") : "Nunca"}</div>
                      {status?.reason && <div className="text-[10px] font-medium">{status.reason}</div>}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground mt-1">Vazio</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}