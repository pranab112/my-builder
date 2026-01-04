// This file is deprecated in favor of 'stores/globalStore.ts'.
// Kept temporarily to prevent build breaks if other files still reference it,
// but all core logic has moved to the global store backed by services/backend.ts.

import React, { createContext, useContext } from 'react';

const AuthContext = createContext<any>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  // If this hook is still called, it means a component hasn't been migrated.
  console.warn("Usage of deprecated useAuth detected. Please migrate to useGlobalStore.");
  return { user: null, login: async () => {}, logout: () => {} };
};
