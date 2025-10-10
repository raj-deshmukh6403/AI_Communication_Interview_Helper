import apiService from './api';
import { API_ENDPOINTS, STORAGE_KEYS } from '../utils/constants';

const authService = {
  /**
   * Register a new user
   */
  register: async (userData) => {
    try {
      const response = await apiService.post(API_ENDPOINTS.REGISTER, {
        email: userData.email,
        password: userData.password,
        full_name: userData.fullName,
      });
      
      // Store token and user data
      if (response.access_token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.access_token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Login user
   */
  login: async (email, password) => {
    try {
      // FastAPI OAuth2PasswordRequestForm expects form data
      const formData = new URLSearchParams();
      formData.append('username', email); // OAuth2 uses 'username' field
      formData.append('password', password);
      
      const response = await apiService.post(
        API_ENDPOINTS.LOGIN,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      // Store token and user data
      if (response.access_token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.access_token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      // Call logout endpoint
      await apiService.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
      // Continue with local logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      
      // Redirect to login
      window.location.href = '/login';
    }
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.ME);
      
      // Update stored user data
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response));
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Change password
   */
  changePassword: async (oldPassword, newPassword) => {
    try {
      const response = await apiService.post(API_ENDPOINTS.CHANGE_PASSWORD, {
        old_password: oldPassword,
        new_password: newPassword,
      });
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get stored auth token
   */
  getToken: () => {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  /**
   * Get stored user data
   */
  getUserData: () => {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  },

  /**
   * Clear authentication data
   */
  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  },
};

export default authService;