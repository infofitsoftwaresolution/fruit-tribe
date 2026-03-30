import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { getEffectiveApiBase, getAuthProfile, registerUser } from '@/lib/api';
import { useStore } from '@/app/context/StoreContext';

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
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
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
  const store = useStore();
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

  // Sellers need sellerId/storeName to scope catalog & orders; hydrate from API for older sessions.
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (!token || !user || user.role !== 'seller') return;
    if (user.sellerId) return;
    let cancelled = false;
    getAuthProfile()
      .then((p) => {
        if (cancelled || !p.seller?.id) return;
        setUser((prev) => {
          if (!prev) return prev;
          const next: User = {
            ...prev,
            sellerId: p.seller!.id,
            sellerStoreName: p.seller!.storeName,
          };
          localStorage.setItem('user', JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        /* offline or expired token */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, user?.sellerId]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${getEffectiveApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        // Do not surface raw backend error messages to the user
        throw new Error('Invalid email or password.');
      }

      const data = await res.json();
      const token = data.accessToken;
      const u = data.user;

      if (!token || !u) {
        throw new Error('Invalid login response.');
      }

      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || email.split('@')[0];
      const seller = u.seller as { id?: string; storeName?: string } | undefined;
      const userData: User = {
        id: u.id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: u.email,
        role: mapBackendRoleToFrontend(u.role),
        phone: '',
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
      toast.error('Login failed. Please check your email and password.');
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string, role: UserRole = 'customer') => {
    try {
      await registerUser({ name, email, password });
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
    try {
      store.clearCart();
      localStorage.removeItem('store_cart');
    } catch {
      // ignore cart clearing failures
    }
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
