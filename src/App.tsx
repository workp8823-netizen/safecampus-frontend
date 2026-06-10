import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import Analytics from "./pages/Analytics";
import MapPage from "./pages/Map";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OnboardInstitution from "./pages/OnboardInstitution";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Officers from "./pages/Officers";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminInstitutions from "./pages/SuperAdminInstitutions";
import SuperAdminSystem from "./pages/SuperAdminSystem";
import SuperAdminSettings from "./pages/Settings"; // Reuse existing settings or create new one
import NotFound from "./pages/NotFound";
import Alerts from "./pages/Alerts";
import CreateAlert from "./pages/CreateAlert";
import Buddies from "./pages/Buddies";
import EmergencyContacts from "./pages/EmergencyContacts";
import NotificationSettings from "./pages/NotificationSettings";
import PrivacySecurity from "./pages/PrivacySecurity";
import Incidents from "./pages/Incidents";
import Settings from "./pages/Settings";
import { RoleLayoutSwitcher } from "./components/RoleLayoutSwitcher";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";

import { useEffect } from "react";
import { toast } from "sonner";
import { WifiOff, Wifi } from "lucide-react";

function App() {
  useEffect(() => {
    const handleOnline = () => {
      toast.success("Back Online", {
        description: "Your internet connection has been restored.",
        icon: <Wifi className="h-4 w-4" />,
      });
    };

    const handleOffline = () => {
      toast.error("Network Offline", {
        description: "Please check your internet connection. Some features may be unavailable.",
        icon: <WifiOff className="h-4 w-4" />,
        duration: Infinity,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <RoleLayoutSwitcher>
          <Routes>
            {/* Public Gateway */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboard" element={<OnboardInstitution />} />

            {/* Interactive Demo (Locked to demo mode) */}
            <Route path="/demo" element={<Home />} />
            <Route path="/demo/dashboard" element={<Dashboard />} />
            <Route path="/demo/report" element={<Report />} />
            <Route path="/demo/analytics" element={<Analytics isDemo={true} />} />
            <Route path="/demo/map" element={<MapPage />} />

            {/* Authenticated Role Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['SCHOOL_ADMIN']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'STAFF']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/security/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['SECURITY']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/report" 
              element={
                <ProtectedRoute>
                  <Report />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute allowedRoles={['SCHOOL_ADMIN']}>
                  <Analytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/incidents" 
              element={
                <ProtectedRoute allowedRoles={['SCHOOL_ADMIN', 'SECURITY']}>
                  <Incidents />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/security/settings" 
              element={
                <ProtectedRoute allowedRoles={['SECURITY']}>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/alerts" 
              element={
                <ProtectedRoute>
                  <Alerts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/alerts/new" 
              element={
                <ProtectedRoute allowedRoles={['SCHOOL_ADMIN', 'SECURITY']}>
                  <CreateAlert />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/map" 
              element={
                <ProtectedRoute>
                  <MapPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/buddies" 
              element={
                <ProtectedRoute>
                  <Buddies />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/emergency-contacts" 
              element={
                <ProtectedRoute>
                  <EmergencyContacts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <NotificationSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/privacy" 
              element={
                <ProtectedRoute>
                  <PrivacySecurity />
                </ProtectedRoute>
              } 
            />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/officers" 
              element={
                <ProtectedRoute allowedRoles={["SCHOOL_ADMIN"]}>
                  <Officers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/super-admin" 
              element={
                <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/super-admin/institutions" 
              element={
                <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                  <SuperAdminInstitutions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/super-admin/system" 
              element={
                <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                  <SuperAdminSystem />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/super-admin/settings" 
              element={
                <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                  <SuperAdminSettings />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RoleLayoutSwitcher>
        <Toaster position="top-right" richColors closeButton duration={5000} />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
