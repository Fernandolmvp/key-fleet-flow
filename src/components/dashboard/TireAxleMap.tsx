import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  positions: string[];
  installed: Record<string, { id: string; brand: string; size: string; tread?: number | null }>;
  selected?: string | null;
  onSelect?: (pos: string) => void;
}

/** Mapa simples de posições agrupadas por eixo (códigos como DD/DE/1DD/etc.). */
export default function TireAxleMap({ positions, installed, selected, onSelect }: Props) {
  // Group by axle prefix (everything except last 2 chars), or by single character group.
  const groups: Record<string, string[]> = {};
  positions.forEach((p) => {
    const m = p.match(/^([A-Z]?-?\d*[A-Z]*?)([DT])([DEI]{1,2})$/);
    const key = m ? m[1] || m[2] : p.length <= 3 ? p[0] : p.slice(0, -2);
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
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelect?.(p)}
                  className={cn(
                    "min-w-[88px] rounded-md border px-2 py-2 text-left transition-all",
                    tire
                      ? "border-primary/40 bg-primary/10 hover:bg-primary/20"
                      : "border-dashed border-border bg-muted/20 hover:bg-muted/40",
                    isSel && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center gap-1 text-xs font-mono text-primary">
                    <CircleDot className="h-3 w-3" /> {p}
                  </div>
                  {tire ? (
                    <div className="mt-1">
                      <div className="text-[11px] font-medium truncate">{tire.brand}</div>
                      <div className="text-[10px] text-muted-foreground">{tire.size}</div>
                      {tire.tread != null && (
                        <div className="text-[10px] font-mono">{tire.tread}mm</div>
                      )}
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