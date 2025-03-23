// front-end/src/store/useChatStore.js
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
  groupChats: [],

  createGroupChat: async (groupData) => {
    try {
      const response = await axiosInstance.post("/group-chats", groupData);
      if (response.status !== 201 && response.status !== 200) {
        throw new Error("Failed to create group chat");
      }
      const newGroupChat = response.data;
      set((state) => ({ groupChats: [...state.groupChats, newGroupChat] }));
      return newGroupChat;
    } catch (error) {
      console.error(
        "Error creating group chat:",
        error?.response?.data || error.message
      );
      throw error;
    }
  },

  getGroupChats: async () => {
    try {
      const response = await axiosInstance.get("/group-chats?populate=members");
      set({ groupChats: response.data });
      console.log("Fetched group chats:", response.data);
    } catch (error) {
      console.error("Error fetching group chats:", error);
      toast.error("Failed to fetch group chats");
    }
  },

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
      console.log(
        "Fetching messages from:",
        axiosInstance.defaults.baseURL + `/messages/${userId}`
      );
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data, isChatCleared: false });
      console.log(`Fetched messages for user ${userId}:`, res.data);
    } catch (error) {
      console.error("Error fetching messages:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (data, type = "text") => {
    const { selectedUser, groupChats } = get();
    if (!selectedUser) {
      toast.error("No user selected to send message");
      return;
    }

    try {
      const isGroupChat = groupChats.some(
        (group) => group._id === selectedUser._id
      );
      let endpoint;
      let headers = {};

      if (isGroupChat) {
        endpoint = `/messages/group/${selectedUser._id}`;
        headers = {
          "Content-Type":
            type === "text" ? "application/json" : "multipart/form-data",
        };
      } else {
        if (type === "text") {
          endpoint = `/messages/send/${selectedUser._id}`;
          headers = { "Content-Type": "application/json" };
        } else if (type === "audio") {
          endpoint = `/messages/${selectedUser._id}/audio`;
          headers = { "Content-Type": "multipart/form-data" };
        } else if (type === "image") {
          endpoint = `/messages/${selectedUser._id}/image`;
          headers = { "Content-Type": "multipart/form-data" };
        } else {
          throw new Error(`Unsupported message type: ${type}`);
        }
      }

      const fullUrl = axiosInstance.defaults.baseURL + endpoint;
      console.log(
        "Sending to:",
        fullUrl,
        "Type:",
        type,
        "Data:",
        data instanceof FormData ? "[FormData]" : data
      );

      const res = await axiosInstance.post(endpoint, data, { headers });
      console.log("sendMessage - Success Response:", res.data);

      // Add the sent message to the local state (for the sender)
      const newMessage = res.data;
      set((state) => {
        const isDuplicate = state.messages.some(
          (msg) => msg._id === newMessage._id
        );
        if (!isDuplicate) {
          console.log("Adding sent message to state:", newMessage);
          return { messages: [...state.messages, newMessage], isTyping: false };
        }
        console.log("Duplicate sent message ignored:", newMessage._id);
        return { isTyping: false };
      });
    } catch (error) {
      console.error("sendMessage - Error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
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
      console.error("clearChatMessages - Error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || "Failed to clear chat");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) {
      console.log("No selected user, cannot subscribe to messages");
      return;
    }

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.log("Socket not available for subscription");
      return;
    }

    console.log("Subscribing to messages for user:", selectedUser._id);

    socket.off("newMessage"); // Remove previous listeners to avoid duplicates
    socket.off("typing");
    socket.off("chatCleared");
    socket.off("groupUpdated");
    socket.off("groupDeleted");
    socket.off("userDeleted");

    socket.on("newMessage", (newMessage) => {
      console.log("Received newMessage:", newMessage);
      const authUserId = useAuthStore.getState().authUser?._id;
      const isGroupChat = selectedUser.isGroupChat;

      if (isGroupChat) {
        // Handle group chat messages
        if (newMessage.chatId === selectedUser._id) {
          set((state) => {
            const isDuplicate = state.messages.some(
              (msg) => msg._id === newMessage._id
            );
            if (!isDuplicate) {
              console.log("Adding new group message to state:", newMessage);
              return { messages: [...state.messages, newMessage] };
            }
            console.log("Duplicate group message ignored:", newMessage._id);
            return state;
          });
        } else {
          console.log("Group message not for this chat:", newMessage.chatId);
        }
      } else {
        // Handle individual chat messages
        if (
          (newMessage.senderId._id === selectedUser._id &&
            newMessage.receiverId === authUserId) ||
          (newMessage.senderId._id === authUserId &&
            newMessage.receiverId === selectedUser._id)
        ) {
          set((state) => {
            const isDuplicate = state.messages.some(
              (msg) => msg._id === newMessage._id
            );
            if (!isDuplicate) {
              console.log("Adding new message to state:", newMessage);
              return { messages: [...state.messages, newMessage] };
            }
            console.log("Duplicate message ignored:", newMessage._id);
            return state;
          });
        } else {
          console.log("Message not relevant to current chat:", newMessage);
        }
      }
    });

    socket.on("typing", (data) => {
      console.log("Typing event received:", data);
      const { userId, typing } = data;
      const authUserId = useAuthStore.getState().authUser?._id;
      if (userId === selectedUser._id && userId !== authUserId) {
        set({ isTyping: typing });
      }
    });

    socket.on("chatCleared", ({ userId }) => {
      console.log("Received chatCleared event for userId:", userId);
      if (selectedUser._id === userId && !get().isChatCleared) {
        set({ messages: [], isChatCleared: true });
        toast.success("Chat has been cleared");
      }
    });

    socket.on("groupUpdated", (updatedGroup) => {
      console.log("Group updated:", updatedGroup);
      if (selectedUser._id === updatedGroup._id) {
        set({ selectedUser: updatedGroup });
      }
      set((state) => ({
        groupChats: state.groupChats.map((g) =>
          g._id === updatedGroup._id ? updatedGroup : g
        ),
      }));
    });

    socket.on("groupDeleted", (groupId) => {
      console.log("Group deleted:", groupId);
      if (selectedUser._id === groupId) {
        set({ selectedUser: null, messages: [] });
      }
      set((state) => ({
        groupChats: state.groupChats.filter((g) => g._id !== groupId),
      }));
    });

    socket.on("userDeleted", (data) => {
      console.log("Received userDeleted event for userId:", data.userId);
      set((state) => {
        const updatedUsers = state.users.filter(
          (user) => user._id !== data.userId
        );
        const updatedSelectedUser =
          state.selectedUser?._id === data.userId ? null : state.selectedUser;

        toast(`User has deleted their account.`, {
          style: { background: "#e0f7fa", color: "#0288d1" },
        });

        console.log("Updated users after deletion:", updatedUsers);

        return {
          users: updatedUsers,
          selectedUser: updatedSelectedUser,
        };
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("typing");
      socket.off("chatCleared");
      socket.off("groupUpdated");
      socket.off("groupDeleted");
      socket.off("userDeleted");
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

  updateGroupChat: async (groupId, updates) => {
    try {
      const response = await axiosInstance.put(
        `/group-chats/${groupId}`,
        updates
      );
      const updatedGroup = response.data;
      set((state) => ({
        groupChats: state.groupChats.map((g) =>
          g._id === groupId ? { ...g, ...updatedGroup } : g
        ),
        selectedUser:
          state.selectedUser?._id === groupId
            ? updatedGroup
            : state.selectedUser,
      }));
      return updatedGroup;
    } catch (error) {
      console.error("Error updating group chat:", error);
      throw error;
    }
  },

  deleteGroupChat: async (groupId) => {
    try {
      await axiosInstance.delete(`/group-chats/${groupId}`);
      set((state) => ({
        groupChats: state.groupChats.filter((g) => g._id !== groupId),
        selectedUser:
          state.selectedUser?._id === groupId ? null : state.selectedUser,
      }));
    } catch (error) {
      console.error("Error deleting group chat:", error);
      throw error;
    }
  },

  removeUserFromChat: (chatId, userId) => {
    set((state) => ({
      messages: state.messages.filter(
        (msg) => !(msg.chatId === chatId && msg.senderId === userId)
      ),
      groupChats: state.groupChats.map((group) =>
        group._id === chatId
          ? {
              ...group,
              members: group.members.filter((member) => member._id !== userId),
            }
          : group
      ),
      selectedUser:
        state.selectedUser?._id === chatId
          ? {
              ...state.selectedUser,
              members: state.selectedUser.members.filter(
                (member) => member._id !== userId
              ),
            }
          : state.selectedUser,
    }));
  },

  removeUserFromAllChats: (userId) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.senderId !== userId),
      groupChats: state.groupChats.map((group) => ({
        ...group,
        members: group.members.filter((member) => member._id !== userId),
      })),
      selectedUser: state.selectedUser
        ? {
            ...state.selectedUser,
            members: state.selectedUser.members?.filter(
              (member) => member._id !== userId
            ),
          }
        : null,
    }));
  },
}));