import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Documents from "./pages/app/Documents";
import Approvals from "./pages/app/Approvals";
import DriverFirstAccess from "./pages/auth/DriverFirstAccess";
import ResetPassword from "./pages/auth/ResetPassword";
import Subscription from "./pages/app/Subscription";
import Brokers from "./pages/app/Brokers";
import Checklists from "./pages/app/Checklists";
import Insurance from "./pages/app/Insurance";
import Configuracoes from "./pages/app/Configuracoes";
import SuperAdmin from "./pages/admin/SuperAdmin";
import SuperAdminBootstrap from "./pages/admin/SuperAdminBootstrap";
import NotFound from "./pages/NotFound";
import PlanSelection from "./pages/auth/PlanSelection";
import Welcome from "./pages/auth/Welcome";
import RequireAuth from "./components/auth/RequireAuth";
import RequireActiveSubscription from "./components/auth/RequireActiveSubscription";
import RequireJustPaid from "./components/auth/RequireJustPaid";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/motorista/primeiro-acesso" element={<DriverFirstAccess />} />
            <Route path="/motorista" element={<MotoristaShell />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/super-admin/ativar" element={<SuperAdminBootstrap />} />
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
              <Route path="brokers" element={<Brokers />} />
              <Route path="assinatura" element={<Subscription />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
