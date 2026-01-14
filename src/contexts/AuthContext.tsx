import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '@/types';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  validateEmail: (email: string) => { valid: boolean; error?: string };
  checkDomain: (email: string) => Promise<{ registered: boolean; universityName?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('AuthContext: Starting fetchProfile');
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await api.get('/auth/profile/');
          console.log('AuthContext: Profile fetch response', response.data);
          if (response.data.success) {
            setUser(response.data.data);
          }
        } catch (error) {
          console.error('AuthContext: Failed to fetch profile:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      } else {
        console.log('AuthContext: No token found');
      }
      console.log('AuthContext: Setting isLoading to false');
      setIsLoading(false);
    };

    fetchProfile();
  }, []);

  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    const emailLower = email.toLowerCase().trim();

    if (!emailLower.includes('@')) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    // Backend handles domain validation now, but we can still suggest .ac.tz
    if (!emailLower.endsWith('.ac.tz')) {
      return {
        valid: true, // Allow it, but maybe warn or just let checkDomain handle it
        error: undefined
      };
    }

    return { valid: true };
  };

  const checkDomain = async (email: string): Promise<{ registered: boolean; universityName?: string; error?: string }> => {
    try {
      const domain = email.split('@')[1];
      console.log('AuthContext: checkDomain called for:', email, 'domain:', domain);
      if (!domain) return { registered: false };

      const response = await api.get('/auth/check-domain/', { params: { email } });
      console.log('AuthContext: checkDomain RAW response:', JSON.stringify(response.data, null, 2));

      // Handle both flat and nested formats
      const data = response.data.data || response.data;

      if (response.data.success && data) {
        return {
          registered: !!data.registered,
          universityName: data.university_name || data.universityName
        };
      }
      return { registered: false };
    } catch (error: any) {
      console.error('AuthContext: Domain check failed:', error);
      return {
        registered: false,
        error: error.response?.data?.message || 'Domain check failed'
      };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('AuthContext: login called for:', email);
      const response = await api.post('/auth/login/', {
        email: email.toLowerCase().trim(),
        password,
      });
      console.log('AuthContext: Login API response:', response.data);

      if (response.data.success && response.data.data) {
        const { access, refresh } = response.data.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        console.log('AuthContext: Tokens saved to localStorage');

        // Fetch profile to get user details
        console.log('AuthContext: Fetching profile after successful login...');
        const profileResponse = await api.get('/auth/profile/');
        console.log('AuthContext: Post-login profile response:', profileResponse.data);
        if (profileResponse.data.success && profileResponse.data.data) {
          setUser(profileResponse.data.data);
          console.log('AuthContext: User state updated, login success');
          return { success: true };
        }
      }
      console.warn('AuthContext: Login failed - success flag false or data missing');
      return { success: false, error: response.data.message || 'Login failed' };
    } catch (error: any) {
      console.error('AuthContext: Login exception:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Invalid email or password'
      };
    }
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      try {
        await api.post('/auth/logout/', { refresh });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      validateEmail,
      checkDomain,
    }}>
      {!isLoading && children}
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
