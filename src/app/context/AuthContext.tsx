import { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { getEffectiveApiBase } from '@/lib/api';

export type UserRole = 'super_admin' | 'admin' | 'seller' | 'customer' | 'delivery_partner';

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
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
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
  if (r === 'SUPER_ADMIN') return 'super_admin';
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
      return parsedUser;
    }
    return null;
  });

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${getEffectiveApiBase()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid email or password.');
      }

      const data = await res.json();
      const token = data.accessToken;
      const u = data.user;

      if (!token || !u) {
        throw new Error('Invalid login response.');
      }

      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || email.split('@')[0];
      const userData: User = {
        id: u.id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: u.email,
        role: mapBackendRoleToFrontend(u.role),
        phone: '',
        address: '',
        memberSince: new Date().getFullYear().toString(),
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      toast.success(`Welcome back, ${userData.name}!`);
    } catch (error: any) {
      toast.error(error?.message || 'Login failed. Please check your credentials.');
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string, role: UserRole = 'customer') => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));

      const userData: User = {
        id: Date.now().toString(),
        name: name,
        email: email,
        role: role,
        phone: '',
        address: '',
        memberSince: new Date().getFullYear().toString(),
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      toast.success('Account created successfully!');
    } catch (error) {
      toast.error('Signup failed. Please try again.');
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
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
