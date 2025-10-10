import React, { createContext, useContext } from 'react';
import useAuth from '../hooks/useAuth';

/**
 * Auth Context for global authentication state
 */
const AuthContext = createContext(null);

/**
 * Auth Provider Component
 */
export const AuthProvider = ({ children }) => {
  const auth = useAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use auth context
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  
  return context;
};

export default AuthContext;