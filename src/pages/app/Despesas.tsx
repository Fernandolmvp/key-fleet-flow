import { Receipt } from "lucide-react";
import ModulePlaceholder from "@/components/placeholder/ModulePlaceholder";

export default function Despesas() {
  return (
    <ModulePlaceholder
      icon={Receipt}
      title="Módulo de Despesas em construção"
      subtitle="Em breve você poderá controlar todas as despesas operacionais da sua frota num só lugar."
      features={[
        "IPVA e licenciamento com alerta de vencimento",
        "Pedágio, lavagem, estacionamento e adesivação",
        "Upload de comprovantes e notas fiscais",
        "Custo total acumulado por veículo e por período",
        "Despesas a pagar com calendário de vencimentos",
      ]}
    />
  );
}