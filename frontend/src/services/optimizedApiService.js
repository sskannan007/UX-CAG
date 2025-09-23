import config from '../config.js';
import { auditLogsCache, feedbackCache, filesCache, usersCache } from './cacheService.js';

class OptimizedApiService {
  constructor() {
    this.baseURL = config.BASE_URL;
    this.requestQueue = new Map();
    this.batchSize = 20;
    this.batchDelay = 100; // ms
  }

  async request(url, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  // Cached API calls
  async getAuditLogs(params = {}) {
    const cacheKey = JSON.stringify(params);
    
    if (auditLogsCache.has(cacheKey)) {
      return auditLogsCache.get(cacheKey);
    }

    const queryParams = new URLSearchParams(params);
    const url = `${this.baseURL}/admin/audit-logs?${queryParams}`;
    const data = await this.request(url);
    
    auditLogsCache.set(cacheKey, data);
    return data;
  }

  async getFeedback(params = {}) {
    const cacheKey = JSON.stringify(params);
    
    if (feedbackCache.has(cacheKey)) {
      return feedbackCache.get(cacheKey);
    }

    const queryParams = new URLSearchParams(params);
    const url = `${this.baseURL}/api/data-validation-feedback?${queryParams}`;
    const data = await this.request(url);
    
    feedbackCache.set(cacheKey, data);
    return data;
  }

  async getFilesMetadata(params = {}) {
    const cacheKey = JSON.stringify(params);
    
    if (filesCache.has(cacheKey)) {
      return filesCache.get(cacheKey);
    }

    const queryParams = new URLSearchParams(params);
    const url = `${this.baseURL}/api/uploaded-files/metadata?${queryParams}`;
    const data = await this.request(url);
    
    filesCache.set(cacheKey, data);
    return data;
  }

  async getUsers() {
    if (usersCache.has('users')) {
      return usersCache.get('users');
    }

    const url = `${this.baseURL}/admin/users/list`;
    const data = await this.request(url);
    
    usersCache.set('users', data);
    return data;
  }

  // Batch content loading with queue management
  async getBatchContent(fileIds) {
    if (!fileIds || fileIds.length === 0) {
      return { status: 'success', files: [] };
    }

    // Process in batches to avoid overwhelming the server
    const batches = [];
    for (let i = 0; i < fileIds.length; i += this.batchSize) {
      batches.push(fileIds.slice(i, i + this.batchSize));
    }

    const allFiles = [];
    
    for (const batch of batches) {
      try {
        const url = `${this.baseURL}/api/uploaded-files/batch-content`;
        const data = await this.request(url, {
          method: 'POST',
          body: JSON.stringify(batch)
        });
        
        if (data.status === 'success') {
          allFiles.push(...data.files);
        }
      } catch (error) {
        console.error('Error loading batch:', error);
        // Continue with other batches
      }
    }

    return { status: 'success', files: allFiles };
  }

  // Debounced search
  debouncedSearch = (() => {
    const timeouts = new Map();
    
    return (searchType, searchTerm, callback, delay = 300) => {
      const key = `${searchType}_${searchTerm}`;
      
      if (timeouts.has(key)) {
        clearTimeout(timeouts.get(key));
      }
      
      const timeout = setTimeout(async () => {
        try {
          const result = await callback();
          timeouts.delete(key);
        } catch (error) {
          console.error('Search error:', error);
          timeouts.delete(key);
        }
      }, delay);
      
      timeouts.set(key, timeout);
    };
  })();

  // Clear all caches
  clearAllCaches() {
    auditLogsCache.clear();
    feedbackCache.clear();
    filesCache.clear();
    usersCache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      auditLogs: auditLogsCache.getStats(),
      feedback: feedbackCache.getStats(),
      files: filesCache.getStats(),
      users: usersCache.getStats()
    };
  }
}

export default new OptimizedApiService();
