import { AlertTriangle } from "lucide-react";
import ModulePlaceholder from "@/components/placeholder/ModulePlaceholder";

export default function Multas() {
  return (
    <ModulePlaceholder
      icon={AlertTriangle}
      title="Módulo de Multas em construção"
      subtitle="Em breve você poderá centralizar o controle de multas, pontos e recursos da sua frota."
      features={[
        "Cadastro de multas com valor, pontos na CNH e infração",
        "Vínculo com o motorista que estava conduzindo",
        "Controle de status: pendente, paga, em recurso, arquivada",
        "Upload da notificação e foto da infração",
        "Alerta de vencimento e ranking de motoristas",
      ]}
    />
  );
}