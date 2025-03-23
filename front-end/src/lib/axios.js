import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://chat-app-back-k05j.onrender.com/api",
  withCredentials: true,
});

export default axiosInstance;
