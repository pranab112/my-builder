import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  register: (name: string, email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('proshot_current_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string) => {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // Mock DB check
        const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
        const foundUser = users.find((u: User) => u.email === email);

        if (foundUser) {
          setUser(foundUser);
          localStorage.setItem('proshot_current_user', JSON.stringify(foundUser));
          resolve();
        } else {
          // For demo convenience, if no user found, reject.
          reject(new Error("User not found. Please sign up."));
        }
      }, 800);
    });
  };

  const register = async (name: string, email: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const newUser = { name, email };
        const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
        
        // Check if exists
        if (!users.find((u: User) => u.email === email)) {
            users.push(newUser);
            localStorage.setItem('proshot_users', JSON.stringify(users));
        }

        setUser(newUser);
        localStorage.setItem('proshot_current_user', JSON.stringify(newUser));
        resolve();
      }, 800);
    });
  };

  const loginWithGoogle = async () => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Simulate Google User Data
        const googleUser = {
            name: "Alex Designer",
            email: "alex@gmail.com"
        };
        setUser(googleUser);
        localStorage.setItem('proshot_current_user', JSON.stringify(googleUser));
        
        // Ensure user exists in mock db for consistency
        const users = JSON.parse(localStorage.getItem('proshot_users') || '[]');
        if (!users.find((u: User) => u.email === googleUser.email)) {
            users.push(googleUser);
            localStorage.setItem('proshot_users', JSON.stringify(users));
        }
        
        resolve();
      }, 1000);
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('proshot_current_user');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
