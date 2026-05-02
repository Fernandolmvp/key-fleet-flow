import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Settings, Users, Shield, Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MembersTab from "./configuracoes/MembersTab";
import PermissionsTab from "./configuracoes/PermissionsTab";
import CompanyTab from "./configuracoes/CompanyTab";

export default function Configuracoes() {
  const { roles, currentCompanyId, loading } = useAuth();
  const isAdmin = roles.includes("admin");

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentCompanyId) {
    return (
      <div className="surface-card rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Selecione uma empresa para acessar as configurações.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="surface-card rounded-xl p-8 text-center space-y-2">
        <Shield className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="font-display text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Apenas administradores da empresa podem acessar este módulo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <Settings className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Configurações da Empresa</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie membros, perfis de acesso e dados da sua empresa.
          </p>
        </div>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" /> Membros & Perfis
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="h-4 w-4" /> Permissões por Perfil
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" /> Empresa
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members"><MembersTab companyId={currentCompanyId} /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab companyId={currentCompanyId} /></TabsContent>
        <TabsContent value="company"><CompanyTab companyId={currentCompanyId} /></TabsContent>
      </Tabs>
    </div>
  );
}