import { create } from "zustand";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

export const useAuthStore = create((set, get) => ({
  user: null,
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  blockedUsers: [], // Add blockedUsers to initial state
  socket: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await axiosInstance.get("/auth/check");
      console.log("checkAuth - Success:", res.data);
      set({ authUser: res.data });
      get().connectSocket();
      await get().fetchBlockedUsers(); // Fetch blocked users after auth check
    } catch (error) {
      console.error("checkAuth - Error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      set({ authUser: null });
      if (error.response?.status !== 401) {
        toast.error("Failed to check authentication");
      }
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      console.log("login - Success:", res.data);
      set({ authUser: res.data });
      get().connectSocket();
      await get().fetchBlockedUsers(); // Fetch blocked users after login
      toast.success("Logged in successfully");
      return res.data;
    } catch (error) {
      console.error("login - Error:", error.response?.data);
      toast.error(error.response?.data?.message || "Login failed");
      throw error;
    } finally {
      set({ isLoggingIn: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      console.log("signup - Success:", res.data);
      set({ authUser: res.data });
      get().connectSocket();
      await get().fetchBlockedUsers(); // Fetch blocked users after signup
      toast.success("Account created successfully");
      return res.data;
    } catch (error) {
      console.error("signup - Error:", error.response?.data);
      toast.error(error.response?.data?.message || "Signup failed");
      throw error;
    } finally {
      set({ isSigningUp: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null, blockedUsers: [] }); // Reset blockedUsers on logout
      get().disconnectSocket();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Logout failed");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Profile update failed");
      throw error;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  fetchBlockedUsers: async () => {
    try {
      console.log(
        "Fetching blocked users from:",
        `${axiosInstance.defaults.baseURL}/blocked-users`
      );
      const res = await axiosInstance.get("/blocked-users");
      set({ blockedUsers: res.data.blockedUsers || [] });
      console.log("fetchBlockedUsers - Success:", res.data);
      console.log(
        "Fetching blocked users from:",
        `${axiosInstance.defaults.baseURL}/blocked-users`
      );
    } catch (error) {
      console.error("fetchBlockedUsers - Error:", error.response?.data);
      set({ blockedUsers: [] });
      toast.error("Failed to fetch blocked users"); // This toast is triggered
    }
  },

  addBlockedUser: (userId) =>
    set((state) => ({
      blockedUsers: [...(state.blockedUsers || []), userId],
    })),

  removeBlockedUser: (userId) =>
    set((state) => ({
      blockedUsers: (state.blockedUsers || []).filter((id) => id !== userId),
    })),

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser || socket?.connected) return;

    const newSocket = io("http://localhost:5000", {
      query: { userId: authUser._id },
      withCredentials: true,
    });

    newSocket.on("connect", () => console.log("Socket connected"));
    newSocket.on("getOnlineUsers", (userIds) =>
      set({ onlineUsers: userIds || [] })
    );
    newSocket.on("disconnect", () => console.log("Socket disconnected"));

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
  },
}));
