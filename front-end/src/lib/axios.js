import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://chat-app-back-k05j.onrender.com/api',
  withCredentials: true // Important for cookie handling
});

// This will run on every request
axiosInstance.interceptors.request.use(
  (config) => {
    // Try multiple token sources
    const token = localStorage.getItem('token') || 
                  sessionStorage.getItem('token') || 
                  document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/)?.pop();
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log("Request with auth header:", config.url, config.headers['Authorization']);
    } else {
      console.warn("No token available for request:", config.url);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses globally
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("401 Unauthorized response for:", error.config.url);
      // Optionally handle token refresh or logout on expired tokens
      if (error.response.data.message === "Token expired") {
        // Implement token refresh logic here
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
