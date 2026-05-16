import { Navigate, useLocation } from "react-router-dom";
import { Wrench, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";
import OficinaDashboard from "./OficinaDashboard";
import OficinaOSList from "./OficinaOSList";
import OficinaAgenda from "./OficinaAgenda";
import OficinaAvaliacoes from "./OficinaAvaliacoes";

export default function OficinaShell() {
  const { token, user, workshop, loading, logout } = useWorkshopAuth();
  const loc = useLocation();
  const [tab, setTab] = useState("dashboard");

  if (loading) return null;
  if (!token) return <Navigate to="/oficina/login" replace state={{ from: loc }} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base">{workshop?.name ?? "Oficina"}</h1>
              <p className="text-[11px] text-muted-foreground">{user?.name} · {user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="os">Ordens de Serviço</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4"><OficinaDashboard /></TabsContent>
          <TabsContent value="os" className="mt-4"><OficinaOSList /></TabsContent>
          <TabsContent value="agenda" className="mt-4"><OficinaAgenda /></TabsContent>
          <TabsContent value="avaliacoes" className="mt-4"><OficinaAvaliacoes /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}