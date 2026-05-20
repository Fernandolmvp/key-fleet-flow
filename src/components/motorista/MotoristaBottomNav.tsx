import { NavLink } from "react-router-dom";
import { Home, Fuel, Wrench, Calendar, Route } from "lucide-react";

const items = [
  { to: "/motorista", icon: Home, label: "Início", end: true },
  { to: "/motorista/abastecimento", icon: Fuel, label: "Abastecer" },
  { to: "/motorista/manutencao", icon: Wrench, label: "Manutenção" },
  { to: "/motorista/calendario", icon: Calendar, label: "Calendário" },
  { to: "/motorista/viagens", icon: Route, label: "Viagens" },
];

export default function MotoristaBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <div className="grid grid-cols-5 max-w-md mx-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-h-[56px] ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <it.icon className="h-5 w-5" />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}