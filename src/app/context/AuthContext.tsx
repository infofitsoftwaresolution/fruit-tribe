import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getEffectiveApiBase, getAuthProfile, registerUser } from '@/lib/api';
import { getUserErrorMessage } from '@/lib/userError';

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
  isSessionChecked: boolean;
  /** `emailOrPhone` is sent as the `email` field in the login API for backward compatibility. */
  login: (emailOrPhone: string, password: string) => Promise<void>;
  signup: (name: string, email: string, phone: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  /** Merge role, seller, and profile fields from GET /auth/me (no toast). */
  refreshSessionFromServer: () => Promise<void>;
  /** Update both storage and state immediately (e.g. for OTP login success). */
  loginWithTokenAndUser: (token: string, userData: User, requirePasswordChange?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

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
    const parsedUser = safeParseJson<User & { role?: string }>(localStorage.getItem('user'));
    if (parsedUser) {
      // PATCH: Migration for legacy users without role — default to 'customer' (NOT admin)
      if (!parsedUser.role) {
        parsedUser.role = 'customer';
        localStorage.setItem('user', JSON.stringify(parsedUser));
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
  const [isSessionChecked, setIsSessionChecked] = useState(false);

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

    if (!token || !stored) {
      setIsSessionChecked(true);
      return;
    }

    void (async () => {
      try {
        await refreshSessionFromServer();
      } finally {
        setIsSessionChecked(true);
      }
    })();
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
          if (!verifyEmail && typeof data?.phone === 'string' && data.phone.trim()) {
            verifyEmail = data.phone.trim();
          }
          const backendMessage = Array.isArray(data?.message)
            ? data.message.join('; ')
            : (data?.message || '');
          if (
            backendMessage === 'EMAIL_PENDING_VERIFICATION_OTP_RESENT' ||
            backendMessage === 'PHONE_PENDING_VERIFICATION_OTP_RESENT'
          ) {
            message = 'Your account is not verified yet. We sent a new OTP to your phone or email.';
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
      toast.error(getUserErrorMessage(error, 'Login failed. Please check your email or mobile and password.'));
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
      toast.success('Account created. We sent an OTP to your phone or email.', {
        description: 'Enter the OTP to complete your registration.',
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
        isSessionChecked,
        login,
        signup,
        logout,
        updateUser,
        refreshSessionFromServer,
        loginWithTokenAndUser: (token: string, userData: User, rpc: boolean = false) => {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('requirePasswordChange', String(rpc));
          setUser(userData);
          setRequirePasswordChange(rpc);
        }
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
