import { create } from "zustand";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  isChatCleared: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    console.log("Starting to fetch users...");
    try {
      const res = await axiosInstance.get("/messages/users");
      console.log("API Response for /messages/users:", res.data);
      if (!res.data || res.data.length === 0) {
        console.log("No users found in the response");
        toast.error("No users found");
      } else {
        set({ users: res.data });
        console.log("Users set in state:", res.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data, isChatCleared: false });
      console.log(`Fetched messages for user ${userId}:`, res.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error(error.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (formData, type = "text") => {
    const { selectedUser, messages } = get();
    if (!selectedUser) return;

    try {
      const endpoint =
        type === "audio"
          ? `/${selectedUser._id}/audio`
          : `/send/${selectedUser._id}`;
      console.log("Sending to:", `/messages${endpoint}`, "Type:", type);
      const res = await axiosInstance.post(`/messages${endpoint}`, formData, {
        headers: {
          "Content-Type": type === "audio" ? "multipart/form-data" : undefined,
        },
      });
      console.log("sendMessage - Success Response:", res.data);
      const newMessage = res.data;
      // Only update state if the message isn't already present
      set((state) => {
        const isDuplicate = state.messages.some(
          (msg) => msg._id === newMessage._id
        );
        if (!isDuplicate) {
          return { messages: [...state.messages, newMessage], isTyping: false };
        }
        return { isTyping: false }; // Avoid duplicate if already exists
      });
    } catch (error) {
      console.error("sendMessage - Error:", error);
      toast.error(error.response?.data?.message || "Failed to send message");
      throw error;
    }
  },

  clearChatMessages: async (userId) => {
    const { selectedUser, isChatCleared } = get();
    const targetUserId = userId || selectedUser?._id;
    if (!targetUserId) {
      toast.error("No user selected to clear chat");
      return;
    }
    if (isChatCleared) {
      console.log(`Chat already cleared for userId: ${targetUserId}, skipping`);
      return;
    }
    try {
      await axiosInstance.post(`/clear-chat/${targetUserId}`);
      set({ messages: [], isChatCleared: true });
      console.log("Cleared chat locally for userId:", targetUserId);
    } catch (error) {
      console.error("clearChatMessages - Error:", error);
      toast.error(error.response?.data?.message || "Failed to clear chat");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.log("Socket not available for subscription");
      return;
    }

    console.log("Subscribing to messages for user:", selectedUser._id);

    const handleNewMessage = (newMessage) => {
      console.log("Received newMessage (sender check):", newMessage);
      const authUserId = useAuthStore.getState().authUser?._id;
      // Only update if the message is from the other user (not the sender's own message)
      if (String(newMessage.senderId) !== String(authUserId)) {
        set((state) => {
          const updatedMessages = [...state.messages, newMessage];
          console.log("Updated messages state from receiver:", updatedMessages);
          return { messages: updatedMessages };
        });
      } else {
        console.log("Ignoring own message from socket:", newMessage._id);
      }
    };

    const handleTyping = (data) => {
      console.log("Typing event received:", data);
      const { userId, typing } = data;
      const authUserId = useAuthStore.getState().authUser?._id;
      if (userId === selectedUser._id && userId !== authUserId) {
        set({ isTyping: typing });
      }
    };

    const handleChatCleared = ({ userId }) => {
      console.log("Received chatCleared event for userId:", userId);
      if (get().selectedUser?._id === userId && !get().isChatCleared) {
        set({ messages: [], isChatCleared: true });
        toast.success("Chat has been cleared");
      }
    };

    // Remove existing listeners to prevent duplicates
    socket.off("newMessage");
    socket.off("typing");
    socket.off("chatCleared");

    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("chatCleared", handleChatCleared);

    console.log("Socket listeners active for newMessage:", socket.listeners("newMessage").length);
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("typing");
      socket.off("chatCleared");
      console.log("Unsubscribed from all socket events");
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser, isTyping: false, isChatCleared: false });
    if (selectedUser) {
      get().getMessages(selectedUser._id);
      get().subscribeToMessages();
    } else {
      get().unsubscribeFromMessages();
      set({ messages: [], isChatCleared: false });
    }
  },

  setTypingStatus: (typing) => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    const authUserId = useAuthStore.getState().authUser?._id;
    if (socket && authUserId) {
      console.log("Emitting typing event:", {
        userId: authUserId,
        receiverId: selectedUser._id,
        typing,
      });
      socket.emit("typing", {
        userId: authUserId,
        receiverId: selectedUser._id,
        typing,
      });
    }
  },
}));