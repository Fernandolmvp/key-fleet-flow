import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Vehicles from "./pages/app/Vehicles";
import Drivers from "./pages/app/Drivers";
import Fuel from "./pages/app/Fuel";
import FuelStations from "./pages/app/FuelStations";
import Maintenance from "./pages/app/Maintenance";
import Tires from "./pages/app/Tires";
import Colaborador from "./pages/app/Colaborador";
import MotoristaShell from "./pages/motorista/MotoristaShell";
import MotoristaViagens from "./pages/motorista/MotoristaViagens";
import MotoristaViagemDetalhe from "./pages/motorista/MotoristaViagemDetalhe";
import MotoristaManutencao from "./pages/motorista/MotoristaManutencao";
import MotoristaCalendario from "./pages/motorista/MotoristaCalendario";
import Documents from "./pages/app/Documents";
import Approvals from "./pages/app/Approvals";
import DriverFirstAccess from "./pages/auth/DriverFirstAccess";
import ResetPassword from "./pages/auth/ResetPassword";
import Subscription from "./pages/app/Subscription";
import Brokers from "./pages/app/Brokers";
import Workshops from "./pages/app/Workshops";
import Suppliers from "./pages/app/Suppliers";
import Checklists from "./pages/app/Checklists";
import Insurance from "./pages/app/Insurance";
import InsuranceOrphans from "./pages/app/insurance/Orphans";
import ReviewMatches from "./pages/app/insurance/ReviewMatches";
import Configuracoes from "./pages/app/Configuracoes";
import Sinistros from "./pages/app/Sinistros";
import Despesas from "./pages/app/Despesas";
import Multas from "./pages/app/Multas";
import Viagens from "./pages/app/Viagens";
import ManutencaoSolicitacoes from "./pages/app/ManutencaoSolicitacoes";
import VehicleHistory from "./pages/app/VehicleHistory";
import SuperAdminShell from "./pages/admin/SuperAdminShell";
import CompaniesPanel from "./pages/admin/CompaniesPanel";
import ProvidersPage from "./pages/admin/ai/ProvidersPage";
import ModelsPage from "./pages/admin/ai/ModelsPage";
import RoutingPage from "./pages/admin/ai/RoutingPage";
import UsagePage from "./pages/admin/ai/UsagePage";
import SuperAdminBootstrap from "./pages/admin/SuperAdminBootstrap";
import NotFound from "./pages/NotFound";
import PlanSelection from "./pages/auth/PlanSelection";
import Welcome from "./pages/auth/Welcome";
import RequireAuth from "./components/auth/RequireAuth";
import RequireActiveSubscription from "./components/auth/RequireActiveSubscription";
import RequireJustPaid from "./components/auth/RequireJustPaid";
import { PostoAuthProvider } from "./contexts/PostoAuthContext";
import PostoLogin from "./pages/posto/PostoLogin";
import PostoShell from "./pages/posto/PostoShell";
import PartnerInviteAccept from "./pages/parceiro/PartnerInviteAccept";
import Termos from "./pages/legal/Termos";
import Privacidade from "./pages/legal/Privacidade";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
         <PostoAuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/motorista/primeiro-acesso" element={<DriverFirstAccess />} />
            <Route path="/motorista" element={<MotoristaShell />} />
            <Route element={<RequireAuth />}>
              <Route path="/motorista/viagens" element={<MotoristaViagens />} />
              <Route path="/motorista/viagens/:id" element={<MotoristaViagemDetalhe />} />
              <Route path="/motorista/manutencao" element={<MotoristaManutencao />} />
              <Route path="/motorista/calendario" element={<MotoristaCalendario />} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/super-admin" element={<SuperAdminShell />}>
              <Route index element={<CompaniesPanel />} />
              <Route path="ai/providers" element={<ProvidersPage />} />
              <Route path="ai/models" element={<ModelsPage />} />
              <Route path="ai/routing" element={<RoutingPage />} />
              <Route path="ai/usage" element={<UsagePage />} />
            </Route>
            <Route path="/super-admin/ativar" element={<SuperAdminBootstrap />} />
            <Route path="/posto/login" element={<PostoLogin />} />
            <Route path="/posto" element={<PostoShell />} />
            <Route path="/parceiro/convite" element={<PartnerInviteAccept />} />
            <Route element={<RequireAuth />}>
              <Route path="/planos" element={<PlanSelection />} />
              <Route element={<RequireJustPaid />}>
                <Route path="/boas-vindas" element={<Welcome />} />
              </Route>
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<RequireActiveSubscription />}>
                <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="fuel-stations" element={<FuelStations />} />
              <Route path="fuel" element={<Fuel />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="checklists" element={<Checklists />} />
              <Route path="tires" element={<Tires />} />
              <Route path="documents" element={<Documents />} />
              <Route path="insurance" element={<Insurance />} />
              <Route path="insurance/orphans" element={<InsuranceOrphans />} />
              <Route path="insurance/review-matches" element={<ReviewMatches />} />
              <Route path="brokers" element={<Brokers />} />
              <Route path="workshops" element={<Workshops />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="assinatura" element={<Subscription />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
                  <Route path="sinistros" element={<Sinistros />} />
                  <Route path="despesas" element={<Despesas />} />
                  <Route path="multas" element={<Multas />} />
                  <Route path="viagens" element={<Viagens />} />
                  <Route path="manutencao/solicitacoes" element={<ManutencaoSolicitacoes />} />
                  <Route path="vehicles/:id/historico" element={<VehicleHistory />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
         </PostoAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
