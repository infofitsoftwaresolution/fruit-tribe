import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '@/app/context/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const { user, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated && allowedRoles && user && !allowedRoles.includes(user.role)) {
            toast.error("You don't have permission to access this area");
        }
    }, [isAuthenticated, user, allowedRoles]);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        // Redirect to home or specific dashboard unauthorized page
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
