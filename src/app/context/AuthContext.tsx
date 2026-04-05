import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getEffectiveApiBase, getAuthProfile, registerUser } from '@/lib/api';

export type UserRole = 'admin' | 'seller' | 'customer' | 'delivery_partner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  address: string;
  avatar?: string;
  memberSince: string;
  storeId?: string; // For sellers and admins managing specific stores
  loyaltyPoints?: number;
  referralCode?: string;
  sellerId?: string;
  sellerStoreName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  requirePasswordChange: boolean;
  /** `emailOrPhone` is sent as the `email` field in the login API for backward compatibility. */
  login: (emailOrPhone: string, password: string) => Promise<void>;
  signup: (name: string, email: string, phone: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  /** Merge role, seller, and profile fields from GET /auth/me (no toast). */
  refreshSessionFromServer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapBackendRoleToFrontend(role: string | undefined): UserRole {
  if (!role) return 'customer';
  const r = role.toUpperCase();
  if (r === 'ADMIN') return 'admin';
  if (r === 'SELLER') return 'seller';
  if (r === 'CUSTOMER') return 'customer';
  if (r === 'SUPER_ADMIN') return 'admin';
  if (r === 'DELIVERY_PARTNER' || r === 'DELIVERY') return 'delivery_partner';
  return 'customer';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Check for stored user in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      // PATCH: Migration for legacy users without role
      if (!parsedUser.role) {
        parsedUser.role = 'admin'; // Default to admin for existing dev sessions
        localStorage.setItem('user', JSON.stringify(parsedUser)); // Update storage
      }
      const rawRole = parsedUser.role as string | undefined;
      if (rawRole && ['super_admin', 'SUPER_ADMIN'].includes(String(rawRole))) {
        parsedUser.role = 'admin';
        localStorage.setItem('user', JSON.stringify(parsedUser));
      }
      return parsedUser;
    }
    return null;
  });
  const [requirePasswordChange, setRequirePasswordChange] = useState<boolean>(() => {
    const stored = localStorage.getItem('requirePasswordChange');
    return stored === 'true';
  });

  const refreshSessionFromServer = useCallback(async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (!token) return;
    try {
      const p = await getAuthProfile();
      setUser((prev) => {
        if (!prev || prev.id !== p.id) return prev;
        const mappedRole = mapBackendRoleToFrontend(p.role?.name);
        const seller = p.seller as { id?: string; storeName?: string } | undefined;
        const nameParts = [p.firstName, p.lastName].filter(Boolean).join(' ');
        const name = nameParts
          ? nameParts.charAt(0).toUpperCase() + nameParts.slice(1)
          : prev.name;
        const next: User = {
          ...prev,
          name,
          email: p.email,
          phone: typeof p.phone === 'string' ? p.phone : prev.phone,
          role: mappedRole,
          sellerId: seller?.id ?? prev.sellerId,
          sellerStoreName: seller?.storeName ?? prev.sellerStoreName,
        };
        const same =
          prev.role === next.role &&
          prev.email === next.email &&
          prev.phone === next.phone &&
          prev.sellerId === next.sellerId &&
          prev.sellerStoreName === next.sellerStoreName &&
          prev.name === next.name;
        if (same) return prev;
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      });
    } catch {
      /* offline or expired token */
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const stored = localStorage.getItem('user');
    if (!token || !stored) return;
    void refreshSessionFromServer();
  }, [refreshSessionFromServer]);

  const login = async (emailOrPhone: string, password: string) => {
    try {
      const res = await fetch(`${getEffectiveApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailOrPhone.trim(), password }),
      });

      if (!res.ok) {
        let message = 'Invalid credentials.';
        let verifyEmail: string | undefined;
        try {
          const data = await res.json();
          if (typeof data?.email === 'string' && data.email.trim()) {
            verifyEmail = data.email.trim();
          }
          const backendMessage = Array.isArray(data?.message)
            ? data.message.join('; ')
            : (data?.message || '');
          if (backendMessage === 'EMAIL_PENDING_VERIFICATION_OTP_RESENT') {
            message = 'Your email is not verified yet. We sent a new verification code to your email.';
          } else if (typeof backendMessage === 'string' && backendMessage.trim()) {
            message = backendMessage;
          }
        } catch {
          // ignore parse errors and keep default message
        }
        const err = new Error(message) as Error & { verifyEmail?: string };
        if (verifyEmail) err.verifyEmail = verifyEmail;
        throw err;
      }

      const data = await res.json();
      const token = data.accessToken;
      const u = data.user;

      if (!token || !u) {
        throw new Error('Invalid login response.');
      }

      const fromInput =
        emailOrPhone.includes('@')
          ? emailOrPhone.split('@')[0]
          : emailOrPhone.replace(/\D/g, '').slice(-4) || 'User';
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(' ') || fromInput;
      const seller = u.seller as { id?: string; storeName?: string } | undefined;
      const userData: User = {
        id: u.id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: u.email,
        role: mapBackendRoleToFrontend(u.role),
        phone: typeof u.phone === 'string' ? u.phone : '',
        address: '',
        memberSince: new Date().getFullYear().toString(),
        sellerId: seller?.id,
        sellerStoreName: seller?.storeName,
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('requirePasswordChange', String(!!u.requirePasswordChange));
      setUser(userData);
      setRequirePasswordChange(!!u.requirePasswordChange);
      toast.success(`Welcome back, ${userData.name}!`);
    } catch (error: any) {
      toast.error(error?.message || 'Login failed. Please check your email or mobile and password.');
      throw error;
    }
  };

  const signup = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserRole = 'customer'
  ) => {
    try {
      await registerUser({ name, email, phone, password });
      // Store pending credentials for optional auto-login after verification
      try {
        sessionStorage.setItem('pendingSignup', JSON.stringify({ email, password }));
      } catch {
        // ignore storage failures
      }
      toast.success('Account created. We emailed you a verification code.', {
        description: 'Enter the code to complete your registration.',
      });
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setRequirePasswordChange(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('requirePasswordChange');
    toast.info('Logged out successfully');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Profile updated successfully!');
    } else {
      toast.error('Failed to update profile. User not found.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        requirePasswordChange,
        login,
        signup,
        logout,
        updateUser,
        refreshSessionFromServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
