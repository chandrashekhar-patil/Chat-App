import { create } from "zustand";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  blockedUsers: [],
  socket: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await axiosInstance.get("/auth/check");
      console.log("checkAuth - Success:", res.data);
      set({ authUser: res.data });
      get().connectSocket();
      await get().fetchBlockedUsers();
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
    set({ isCheckingAuth: true });
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      console.log("login - Success:", res.data);
      set({ authUser: res.data });
      get().connectSocket();
      await get().fetchBlockedUsers();
      toast.success("Logged in successfully");
      return res.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Login failed";
      console.error("login - Error:", {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
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
      await get().fetchBlockedUsers();
      toast.success("Account created successfully");
      return res.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Signup failed";
      console.error("signup - Error:", error.response?.data);
      toast.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
    } finally {
      set({ isSigningUp: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null, blockedUsers: [], onlineUsers: [], socket: null });
      get().disconnectSocket();
      toast.success("Logged out successfully");
      window.location.href = "/login";
    } catch (error) {
      toast.error(error.response?.data?.message || "Logout failed");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/users/update-profile", data);
      set((state) => ({ authUser: { ...state.authUser, ...res.data } }));
      toast.success("Profile updated successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Profile update failed");
      throw error;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    try {
      await axiosInstance.delete("/auth/delete-account");
      set({
        authUser: null,
        blockedUsers: [],
        onlineUsers: [],
        socket: null,
        isLoading: false,
      });
      get().disconnectSocket();
      toast.success("Account deleted successfully");
      window.location.href = "/login";
    } catch (error) {
      set({ isLoading: false });
      const message =
        error.response?.data?.message || "Failed to delete account";
      toast.error(message);
      throw error;
    }
  },

  forgotPassword: async (email) => {
    set({ isRequestingReset: true });
    try {
      const res = await axiosInstance.post("/password/forgot", { email });
      toast.success(res.data.message);
      return res.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to send reset link";
      toast.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
    } finally {
      set({ isRequestingReset: false });
    }
  },

  resetPassword: async (token, newPassword) => {
    set({ isResettingPassword: true });
    try {
      const res = await axiosInstance.post("/password/reset", {
        token,
        new_password: newPassword,
      });
      toast.success(res.data.message);
      return res.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to reset password";
      toast.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
    } finally {
      set({ isResettingPassword: false });
    }
  },

  fetchBlockedUsers: async () => {
    try {
      const res = await axiosInstance.get("/blocked-users");
      set({ blockedUsers: res.data.blockedUsers || [] });
      console.log("fetchBlockedUsers - Success:", res.data);
    } catch (error) {
      console.error("fetchBlockedUsers - Error:", error.response?.data);
      set({ blockedUsers: [] });
      toast.error("Failed to fetch blocked users");
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
    if (!authUser) {
      console.log("No auth user, cannot connect socket");
      return;
    }
    if (socket?.connected) {
      console.log("Socket already connected:", socket.id);
      return;
    }

    const newSocket = io("http://localhost:5000", {
      query: { userId: authUser._id },
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      // Initialize global socket listeners for chat store
      useChatStore.getState().initializeSocketListeners();
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      toast.error("Failed to connect to chat server");
    });

    newSocket.on("getOnlineUsers", (userIds) => {
      console.log("Online users received:", userIds);
      set({ onlineUsers: userIds || [] });
    });

    newSocket.on("userOnline", (userId) => {
      console.log(`User ${userId} is online`);
      set((state) => ({
        onlineUsers: [...new Set([...state.onlineUsers, userId])],
      }));
    });

    newSocket.on("userOffline", (userId) => {
      console.log(`User ${userId} is offline`);
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== userId),
      }));
    });

    newSocket.on("userDeleted", ({ userId }) => {
      console.log(`User ${userId} deleted their account`);
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== userId),
        blockedUsers: state.blockedUsers.filter((id) => id !== userId),
      }));
      useChatStore.getState().removeUserFromAllChats(userId);
      toast.info("A user has deleted their account");
    });

    newSocket.on("userRemovedFromChat", ({ chatId, userId }) => {
      console.log(`User ${userId} removed from chat ${chatId}`);
      useChatStore.getState().removeUserFromChat(chatId, userId);
      toast.info("A user has left the chat");
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      set({ onlineUsers: [] });
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.off("getOnlineUsers");
      socket.off("userOnline");
      socket.off("userOffline");
      socket.off("userRemovedFromChat");
      socket.off("userDeleted");
      socket.off("disconnect");
      socket.disconnect();
      set({ socket: null, onlineUsers: [], blockedUsers: [] });
      console.log("Socket disconnected and state reset");
    }
  },
}));
