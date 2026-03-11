import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { usePatientAuth, PatientAuthProvider } from "./contexts/PatientAuthContext";
import { StaffProvider } from "./contexts/StaffContext";
import { ClinicSettingsProvider } from "./contexts/ClinicSettingsContext";
import AuthPage from "./components/AuthPage";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientForm from "./pages/PatientForm";
import PatientProfile from "./pages/PatientProfile";
import Appointments from "./pages/Appointments";
import AppointmentForm from "./pages/AppointmentForm";
import Practitioners from "./pages/Practitioners";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import LandingPage from "./pages/LandingPage";
import RegisterPage from "./pages/RegisterPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import AdminPage from "./pages/AdminPage";
import Invoices from "./pages/Invoices";
import InvoiceForm from "./pages/InvoiceForm";
import VirtualConsultation from "./pages/VirtualConsultation";
import PortalLogin from "./pages/PortalLogin";
import PortalDashboard from "./pages/PortalDashboard";
import PortalConsultation from "./pages/PortalConsultation";


function ProtectedRoutes() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <StaffProvider>
      <ClinicSettingsProvider>
        <Layout />
      </ClinicSettingsProvider>
    </StaffProvider>
  );
}

function PatientProtectedRoute() {
  const { token, loading } = usePatientAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!token) return <Navigate to="/portal/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <PatientAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Patient portal — public */}
          <Route path="/portal/login" element={<PortalLogin />} />
          {/* Patient portal — protected */}
          <Route element={<PatientProtectedRoute />}>
            <Route path="/portal/dashboard" element={<PortalDashboard />} />
            <Route path="/portal/consultation" element={<PortalConsultation />} />
          </Route>
          {/* Staff routes */}
          <Route element={<ProtectedRoutes />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/new" element={<PatientForm />} />
            <Route path="/patients/:id/edit" element={<PatientForm />} />
            <Route path="/patients/:id" element={<PatientProfile />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/appointments/new" element={<AppointmentForm />} />
            <Route path="/appointments/:id/edit" element={<AppointmentForm />} />
            <Route path="/practitioners" element={<Practitioners />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="/virtual-consultation" element={<VirtualConsultation />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PatientAuthProvider>
  );
}
