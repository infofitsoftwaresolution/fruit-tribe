import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/app/context/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const { user, isAuthenticated, requirePasswordChange, isSessionChecked } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (isAuthenticated && allowedRoles && user && !allowedRoles.includes(user.role)) {
            toast.error("You don't have permission to access this area");
        }
    }, [isAuthenticated, user, allowedRoles]);

    if (!isSessionChecked) {
        return <div className="min-h-[40vh] flex items-center justify-center text-sm font-semibold text-slate-500">Verifying session...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
    }

    // Force password change before allowing access to protected areas
    if (requirePasswordChange && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        // Redirect to home or specific dashboard unauthorized page
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
