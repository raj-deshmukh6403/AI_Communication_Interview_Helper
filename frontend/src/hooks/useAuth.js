import { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { getErrorMessage } from '../utils/helpers';

/**
 * Custom hook for authentication
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load user data from localStorage on mount
   */
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = authService.getToken();
        const userData = authService.getUserData();
        
        if (token && userData) {
          setUser(userData);
          setIsAuthenticated(true);
          
          // Optionally refresh user data from server
          try {
            const freshUserData = await authService.getCurrentUser();
            setUser(freshUserData);
          } catch (err) {
            // If refresh fails, keep using cached data
            console.warn('Failed to refresh user data:', err);
          }
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUser();
  }, []);

  /**
   * Login user
   */
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true, user: response.user };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (userData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.register(userData);
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true, user: response.user };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  /**
   * Change password
   */
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await authService.changePassword(oldPassword, newPassword);
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Error refreshing user:', err);
      throw err;
    }
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    changePassword,
    refreshUser,
  };
};

export default useAuth;