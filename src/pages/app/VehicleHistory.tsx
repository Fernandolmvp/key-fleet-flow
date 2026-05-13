import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, IdCard, Activity, Wrench, Fuel, CircleDot, FileText,
  AlertOctagon, ClipboardCheck, BarChart3, Users, Download, Sparkles,
} from "lucide-react";

const TABS = [
  { icon: IdCard, label: "Identificação" },
  { icon: Activity, label: "Timeline" },
  { icon: Wrench, label: "Manutenções" },
  { icon: Fuel, label: "Combustível" },
  { icon: CircleDot, label: "Pneus" },
  { icon: FileText, label: "Documentos" },
  { icon: AlertOctagon, label: "Sinistros" },
  { icon: ClipboardCheck, label: "Checklists" },
  { icon: BarChart3, label: "Indicadores Financeiros" },
  { icon: Users, label: "Motoristas" },
  { icon: Download, label: "Exportar" },
];

export default function VehicleHistory() {
  const { id } = useParams<{ id: string }>();
  const [plate, setPlate] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("vehicles").select("plate").eq("id", id).maybeSingle();
      if (data?.plate) setPlate(data.plate);
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link to="/app/vehicles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para veículos
          </Link>
          <h1 className="font-display text-3xl font-bold">
            Histórico de Vida do Veículo{plate ? `: ${plate}` : ""}
          </h1>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Em desenvolvimento — disponível em breve
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {TABS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="surface-card rounded-xl p-5 opacity-70 cursor-not-allowed select-none hover:opacity-90 transition-opacity"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary mb-3">
              <Icon className="h-5 w-5" />
            </div>
            <div className="font-display font-semibold">{label}</div>
            <div className="text-[10px] uppercase font-mono text-muted-foreground mt-2">Em breve</div>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        O Histórico de Vida vai consolidar 360° da operação de cada veículo: documentos,
        manutenções, abastecimentos, pneus, sinistros, checklists, motoristas que conduziram
        e indicadores financeiros (custo/km, depreciação, ROI). Tudo exportável em PDF.
      </p>
    </div>
  );
}