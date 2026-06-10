import { useLocation, Navigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { SecurityLayout } from "@/layouts/SecurityLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { SuperAdminLayout } from "@/layouts/SuperAdminLayout";
import { getCookie, setCookie, deleteCookie } from "@/lib/cookies";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./PageTransition";

export function RoleLayoutSwitcher({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = getCookie('user');
  const isDemoPath = location.pathname.startsWith('/demo');

  // Auth/Onboarding pages (Plain Layout - No Navbar/Footer)
  const authPaths = ["/login", "/signup", "/onboard"];
  if (authPaths.includes(location.pathname)) {
    if (getCookie('isDemo') === true) {
      deleteCookie('isDemo');
    }
    return (
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
          {children}
        </PageTransition>
      </AnimatePresence>
    );
  }

  // Landing page (Public Gateway - Redirect if logged in)
  if (location.pathname === "/" && !isDemoPath) {
    if (user) {
      if (user.role === 'SCHOOL_ADMIN') return <Navigate to="/admin" replace />;
      if (user.role === 'SECURITY') return <Navigate to="/security/dashboard" replace />;
      if (user.role === 'SUPER_ADMIN') return <Navigate to="/super-admin" replace />;
      return <Navigate to="/dashboard" replace />;
    }
    return <PublicLayout>{children}</PublicLayout>;
  }

  // Handle Demo Mode (Only for unauthenticated users)
  if (isDemoPath) {
    // If logged in, redirect away from demo to real dashboard
    if (user) {
      if (user.role === 'SCHOOL_ADMIN') return <Navigate to="/admin" replace />;
      if (user.role === 'SECURITY') return <Navigate to="/security/dashboard" replace />;
      return <Navigate to="/dashboard" replace />;
    }

    // Force demo data flag for pages to consume
    if (getCookie('isDemo') !== true) {
      setCookie('isDemo', true);
    }
    return <PublicLayout>{children}</PublicLayout>;
  }

  // Clear demo flag if not on demo path
  if (!isDemoPath && getCookie('isDemo') === true) {
    deleteCookie('isDemo');
  }

  if (!user) return <>{children}</>;

  const role = user?.role;

  switch (role) {
    case "SUPER_ADMIN":
      return <SuperAdminLayout>{children}</SuperAdminLayout>;
    case "SCHOOL_ADMIN":
      return <AdminLayout>{children}</AdminLayout>;
    case "SECURITY":
      return <SecurityLayout>{children}</SecurityLayout>;
    case "STUDENT":
    case "STAFF":
      return <StudentLayout>{children}</StudentLayout>;
    default:
      return <>{children}</>;
  }
}
