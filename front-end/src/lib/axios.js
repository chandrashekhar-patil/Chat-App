import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://textspin-chandu-b.vercel.app/api",
  withCredentials: true,
});

export default axiosInstance;
