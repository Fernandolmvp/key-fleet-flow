import { Navigate, useLocation } from "react-router-dom";
import { Fuel, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePostoAuth } from "@/contexts/PostoAuthContext";
import PostoConfirmar from "./PostoConfirmar";
import PostoHistorico from "./PostoHistorico";

export default function PostoShell() {
  const { token, user, station, loading, logout } = usePostoAuth();
  const loc = useLocation();
  const [tab, setTab] = useState("confirmar");

  if (loading) return null;
  if (!token) return <Navigate to="/posto/login" replace state={{ from: loc }} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center">
              <Fuel className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base">{station?.name ?? "Posto"}</h1>
              <p className="text-[11px] text-muted-foreground">{user?.name} · {user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="confirmar">Confirmar abastecimento</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="confirmar" className="mt-4"><PostoConfirmar /></TabsContent>
          <TabsContent value="historico" className="mt-4"><PostoHistorico /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}