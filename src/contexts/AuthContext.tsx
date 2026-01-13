import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { users, universities } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  validateEmail: (email: string) => { valid: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    // Check if email ends with @ac.tz (Tanzanian academic domain)
    const emailLower = email.toLowerCase().trim();
    
    if (!emailLower.includes('@')) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    if (!emailLower.endsWith('.ac.tz')) {
      return { 
        valid: false, 
        error: 'Only university emails ending with @xxx.ac.tz are allowed. Example: admin@udsm.ac.tz' 
      };
    }

    // Check if the domain is from a registered university
    const domain = emailLower.split('@')[1];
    const university = universities.find(u => u.emailDomain === domain);
    
    if (!university) {
      return { 
        valid: false, 
        error: `The domain "${domain}" is not registered. Please contact the Super Admin to register your university.` 
      };
    }

    if (!university.isActive) {
      return { 
        valid: false, 
        error: `${university.name} is currently inactive. Please contact the Super Admin.` 
      };
    }

    return { valid: true };
  };

  const login = (email: string, password: string): { success: boolean; error?: string } => {
    const emailLower = email.toLowerCase().trim();

    // Special case for super admin (demo purposes)
    if (emailLower === 'superadmin@system.ac.tz') {
      const superAdmin = users.find(u => u.role === 'super_admin');
      if (superAdmin && password === 'admin123') {
        setUser(superAdmin);
        return { success: true };
      }
    }

    // Validate email domain
    const validation = validateEmail(emailLower);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Find user in mock data
    const foundUser = users.find(u => u.email.toLowerCase() === emailLower);
    
    if (!foundUser) {
      return { 
        success: false, 
        error: 'No account found with this email. Contact your University Admin for access.' 
      };
    }

    // Demo password check (in production, this would be proper auth)
    if (password !== 'password123' && password !== 'admin123') {
      return { success: false, error: 'Invalid password' };
    }

    setUser(foundUser);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      validateEmail,
    }}>
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
