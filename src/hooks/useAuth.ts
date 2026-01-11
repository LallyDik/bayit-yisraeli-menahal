import { useState, useEffect, createContext, useContext } from 'react';
import { authApi, getScriptUrl } from '@/services/googleSheetsApi';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // בדוק אם יש URL מוגדר
    const scriptUrl = getScriptUrl();
    setIsConfigured(!!scriptUrl);
    
    // בדוק אם יש משתמש שמור ב-localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await authApi.signIn(email, password);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (result.user) {
      const userData = result.user as User;
      setUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
    }
  };

  const signUp = async (email: string, password: string) => {
    const result = await authApi.signUp(email, password);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (result.user) {
      const userData = result.user as User;
      setUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isConfigured,
  };
};

export { AuthContext };
