import apiService from './api';
import { API_ENDPOINTS, PAGINATION } from '../utils/constants';

const sessionService = {
  /**
     * Create a new interview session
     */
    createSession: async (sessionData, resumeFile = null) => {
        try {
            const formData = new FormData();
            
            // 🔥 FIX: Better field mapping with fallbacks
            const sessionJson = {
            job_description: sessionData.jobDescription || sessionData.job_description || '',
            company_name: sessionData.companyName || sessionData.company_name || '',
            position: sessionData.position || '',
            resume_text: sessionData.resumeText || sessionData.resume_text || ''
            };
            
            // 🔥 ADD: Validation before sending
            if (!sessionJson.job_description) {
            throw new Error('Job description is required');
            }
            if (!sessionJson.position) {
            throw new Error('Position is required');
            }
            
            console.log('📤 Sending to backend:', sessionJson);
            
            formData.append('session', JSON.stringify(sessionJson));
            
            if (resumeFile) {
            console.log('📎 Resume file:', resumeFile.name);
            formData.append('resume', resumeFile);
            }
            
            const response = await apiService.upload(
            API_ENDPOINTS.CREATE_SESSION,
            formData
            );
            
            console.log('✅ Backend response:', response);
            
            return response;
        } catch (error) {
            console.error('❌ Full error:', error.response?.data);
            throw error;
        }
    },
    /**
     * Get list of sessions
     */
    getSessions: async (limit = PAGINATION.DEFAULT_LIMIT, skip = PAGINATION.DEFAULT_SKIP) => {
        try {
        const response = await apiService.get(
            `${API_ENDPOINTS.SESSIONS}/list?limit=${limit}&skip=${skip}`
        );
        
        return response;
        } catch (error) {
        throw error;
        }
    },

  /**
   * Get session details
   */
  getSessionDetail: async (sessionId) => {
    try {
      const response = await apiService.get(
        API_ENDPOINTS.SESSION_DETAIL(sessionId)
      );
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a session
   */
  deleteSession: async (sessionId) => {
    try {
      await apiService.delete(API_ENDPOINTS.DELETE_SESSION(sessionId));
      return true;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Compare two sessions
   */
  compareSessions: async (session1Id, session2Id) => {
    try {
      const response = await apiService.post(API_ENDPOINTS.COMPARE_SESSIONS, {
        session1_id: session1Id,
        session2_id: session2Id,
      });
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get progress statistics
   */
  getProgressStats: async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.PROGRESS_STATS);
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get session analytics
   */
  getSessionAnalytics: async (sessionId) => {
    try {
      const response = await apiService.get(
        API_ENDPOINTS.SESSION_ANALYTICS(sessionId)
      );
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get user analytics summary
   */
  getUserSummary: async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.USER_SUMMARY);
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get user trends
   */
  getUserTrends: async (days = 30) => {
    try {
      const response = await apiService.get(
        `${API_ENDPOINTS.USER_TRENDS}?days=${days}`
      );
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get weak areas
   */
  getWeakAreas: async (limit = 5) => {
    try {
      const response = await apiService.get(
        `${API_ENDPOINTS.WEAK_AREAS}?limit=${limit}`
      );
      
      return response;
    } catch (error) {
      throw error;
    }
  },
};

export default sessionService;