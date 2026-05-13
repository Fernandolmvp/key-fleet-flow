import { CarFront } from "lucide-react";
import ModulePlaceholder from "@/components/placeholder/ModulePlaceholder";

export default function Sinistros() {
  return (
    <ModulePlaceholder
      icon={CarFront}
      title="Módulo de Sinistros em construção"
      subtitle="Em breve você poderá registrar e acompanhar sinistros da sua frota — do BO ao reparo concluído."
      features={[
        "Registro completo de ocorrências (colisão, raspão, furto, vandalismo, perda total)",
        "Anexar fotos, BO e laudo do reparo",
        "Vínculo automático com a apólice de seguro do veículo",
        "Acompanhamento de status: aberto, em reparo, resolvido",
        "Relatório consolidado de custo e sinistralidade por veículo",
      ]}
    />
  );
}