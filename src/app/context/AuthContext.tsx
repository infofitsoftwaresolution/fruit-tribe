import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getEffectiveApiBase, getAuthProfile, registerUser, updateAuthProfile } from '@/lib/api';

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
  isSessionChecked: boolean;
  requirePasswordChange: boolean;
  /** `emailOrPhone` is sent as the `email` field in the login API for backward compatibility. */
  login: (emailOrPhone: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (name: string, email: string, phone: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  /** Merge role, seller, and profile fields from GET /auth/me (no toast). */
  refreshSessionFromServer: () => Promise<void>;
  /** Update both storage and state immediately (e.g. for OTP login success). */
  loginWithTokenAndUser: (token: string, userData: User, requirePasswordChange?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapBackendRoleToFrontend(role: string | undefined): UserRole {
  if (!role) return 'customer';
  const r = role.toUpperCase();
  if (r === 'ADMIN') return 'admin';
  if (r === 'SELLER') return 'seller';
  if (r === 'CUSTOMER') return 'customer';
  if (r === 'SUPER_ADMIN') return 'admin';
  if (r === 'DELIVERY_PARTNER' || r === 'DELIVERY') return 'delivery_partner';
  return 'customer';
}

function readStoredToken(): string | null {
  return localStorage.getItem('token')
    || localStorage.getItem('accessToken')
    || sessionStorage.getItem('token')
    || sessionStorage.getItem('accessToken');
}

function readStoredUser(): User | null {
  const local = safeParseJson<User | null>(localStorage.getItem('user'), null);
  if (local && typeof local === 'object') return local;
  const session = safeParseJson<User | null>(sessionStorage.getItem('user'), null);
  if (session && typeof session === 'object') return session;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const parsedUser = readStoredUser();
    if (!parsedUser) {
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      return null;
    }
    // Migration for legacy users without role
    if (!parsedUser.role) {
      parsedUser.role = 'customer';
      localStorage.setItem('user', JSON.stringify(parsedUser));
      sessionStorage.setItem('user', JSON.stringify(parsedUser));
    }
    const rawRole = parsedUser.role as string | undefined;
    if (rawRole && ['super_admin', 'SUPER_ADMIN'].includes(String(rawRole))) {
      parsedUser.role = 'admin';
      localStorage.setItem('user', JSON.stringify(parsedUser));
      sessionStorage.setItem('user', JSON.stringify(parsedUser));
    }
    return parsedUser;
  });
  const [requirePasswordChange, setRequirePasswordChange] = useState<boolean>(() => {
    const stored = localStorage.getItem('requirePasswordChange');
    return stored === 'true';
  });
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  const refreshSessionFromServer = useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      setIsSessionChecked(true);
      return;
    }
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
    } finally {
      setIsSessionChecked(true);
    }
  }, []);

  useEffect(() => {
    const token = readStoredToken();
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!token || !stored) {
      setIsSessionChecked(true);
      return;
    }
    void refreshSessionFromServer();
  }, [refreshSessionFromServer]);

  const login = async (emailOrPhone: string, password: string, rememberMe: boolean = true) => {
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

      const storage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;
      storage.setItem('token', token);
      storage.setItem('user', JSON.stringify(userData));
      otherStorage.removeItem('token');
      otherStorage.removeItem('accessToken');
      otherStorage.removeItem('user');
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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
    toast.info('Logged out successfully');
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) {
      toast.error('Failed to update profile. User not found.');
      return;
    }

    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    sessionStorage.setItem('user', JSON.stringify(updatedUser));

    const shouldSyncProfile =
      Object.prototype.hasOwnProperty.call(userData, 'name') ||
      Object.prototype.hasOwnProperty.call(userData, 'phone') ||
      Object.prototype.hasOwnProperty.call(userData, 'address');
    if (!shouldSyncProfile) {
      toast.success('Profile updated successfully!');
      return;
    }

    const nameParts = String(updatedUser.name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    try {
      await updateAuthProfile({
        firstName,
        lastName: lastName || undefined,
        phone: updatedUser.phone || undefined,
        address: updatedUser.address || undefined,
      });
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('user', JSON.stringify(user));
      toast.error(error?.message || 'Could not save profile to server.');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isSessionChecked,
        requirePasswordChange,
        login,
        signup,
        logout,
        updateUser,
        refreshSessionFromServer,
        loginWithTokenAndUser: (token: string, userData: User, rpc: boolean = false) => {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('user');
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
