import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

import { getCookie } from "@/lib/cookies";

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const user = getCookie('user');
  const isDemo = getCookie('isDemo') === true || (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo'));

  if (!user && !isDemo) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If they are logged in but don't have the right role, send them to their respective dashboard
    if (user.role === 'SCHOOL_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'SECURITY') return <Navigate to="/security/dashboard" replace />;
    return <Navigate to="/dashboard" replace />; // Default for students
  }

  return <>{children}</>;
}
