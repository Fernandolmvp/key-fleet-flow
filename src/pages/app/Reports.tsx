import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BarChart3, FileText, ChevronRight, Sparkles } from "lucide-react";

const REPORTS = [
  {
    to: "/app/reports/licenciamento",
    title: "Licenciamento de Veículos",
    description: "Ano de licenciamento, placa, chassi e RENAVAM da frota.",
    icon: FileText,
    available: true,
  },
  {
    to: "/app/reports/veiculos-em-apolice-sem-cadastro",
    title: "Veículos em apólice sem cadastro",
    description: "Placas presentes nas apólices que ainda não constam na frota cadastrada.",
    icon: Sparkles,
    available: true,
  },
  {
    to: "/app/reports/veiculos-completo",
    title: "Veículos — Dados Completos",
    description: "Placa, chassi, RENAVAM, ano/modelo, cor, corretor, seguradora e apólice.",
    icon: FileText,
    available: true,
  },
];

export default function Reports() {
  const loc = useLocation();
  const isIndex = loc.pathname === "/app/reports" || loc.pathname === "/app/reports/";
  if (!isIndex) return <Outlet />;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Relatórios
        </h1>
        <p className="text-sm text-muted-foreground">
          Relatórios operacionais e gerenciais da sua frota.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="surface-card rounded-xl p-5 hover:border-primary/40 transition-colors group"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary mb-3">
              <r.icon className="h-5 w-5" />
            </div>
            <div className="font-display font-semibold flex items-center justify-between">
              {r.title}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}