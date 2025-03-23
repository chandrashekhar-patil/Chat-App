import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://chat-app-back-k05j.onrender.com/api",
  withCredentials: true,
});

// Log request details for debugging
axiosInstance.interceptors.request.use(
  (config) => {
    console.log("Axios request:", {
      url: config.url,
      method: config.method,
      headers: config.headers,
    });
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("Axios response error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default axiosInstance;
