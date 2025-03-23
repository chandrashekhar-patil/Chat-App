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
  unreadCounts: {},

  // Initialize global socket listeners
  initializeSocketListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.log("Socket not available for global subscription");
      return;
    }

    console.log("Initializing global socket listeners");

    // Remove any existing listeners to prevent duplicates
    socket.off("newMessage");
    socket.off("notification");
    socket.off("typing");
    socket.off("chatCleared");
    socket.off("groupUpdated");
    socket.off("groupDeleted");
    socket.off("userDeleted");
    socket.off("userRemovedFromChat");
    socket.off("userOnline");
    socket.off("userOffline");

    socket.on("newMessage", (message) => {
      console.log("Global newMessage received:", message);
      const authUserId = useAuthStore.getState().authUser?._id;
      const currentSelectedUser = get().selectedUser;

      // Update messages if the message is for the currently selected chat
      if (currentSelectedUser) {
        const isGroupChat = currentSelectedUser.isGroupChat;
        if (isGroupChat) {
          if (message.chatId === currentSelectedUser._id) {
            set((state) => {
              const isDuplicate = state.messages.some(
                (msg) => msg._id === message._id
              );
              if (!isDuplicate) {
                console.log("Adding new group message to state:", message);
                return { messages: [...state.messages, message] };
              }
              console.log("Duplicate group message ignored:", message._id);
              return state;
            });
          }
        } else {
          if (
            (message.senderId._id === currentSelectedUser._id &&
              message.receiverId === authUserId) ||
            (message.senderId._id === authUserId &&
              message.receiverId === currentSelectedUser._id)
          ) {
            set((state) => {
              const isDuplicate = state.messages.some(
                (msg) => msg._id === message._id
              );
              if (!isDuplicate) {
                console.log("Adding new message to state:", message);
                return { messages: [...state.messages, message] };
              }
              console.log("Duplicate message ignored:", message._id);
              return state;
            });
          }
        }
      }

      // Update lastMessage in users or groupChats
      set((state) => {
        if (message.chatId) {
          // Group chat message
          return {
            groupChats: state.groupChats.map((group) =>
              group._id === message.chatId
                ? { ...group, lastMessage: message }
                : group
            ),
          };
        } else {
          // Direct message
          const chatUserId =
            message.senderId._id === authUserId
              ? message.receiverId
              : message.senderId._id;
          return {
            users: state.users.map((user) =>
              user._id === chatUserId
                ? { ...user, lastMessage: message }
                : user
            ),
          };
        }
      });

      // Handle notifications for all incoming messages from other users
      const senderId =
        typeof message.senderId === "object"
          ? message.senderId._id
          : message.senderId;
      if (senderId !== authUserId) {
        // Increment unread count only if the message is not from the currently selected chat
        if (
          !currentSelectedUser ||
          (message.chatId && message.chatId !== currentSelectedUser._id) ||
          (!message.chatId && senderId !== currentSelectedUser._id)
        ) {
          const chatId = message.chatId || senderId;
          console.log("Incrementing unread count for chat (global):", chatId);
          get().incrementUnreadCount(chatId);
        }

        // Browser notification for every incoming message
        if (Notification.permission === "granted") {
          const senderName = message.senderId.fullName || "Unknown";
          const content = message.text || (message.image ? "Image" : "Audio");
          const notification = new Notification(
            `New Message from ${senderName}`,
            {
              body: content,
              icon: message.senderId.profilePic || "/avatar.png",
              tag: message._id,
            }
          );
          notification.onclick = () => {
            window.focus();
            // Select the chat when the notification is clicked
            const chatUser = get().users.find((user) => user._id === senderId) || 
                            get().groupChats.find((group) => group._id === message.chatId);
            if (chatUser) {
              get().setSelectedUser(chatUser);
            }
          };
          const audio = new Audio("/notification.mp3");
          audio
            .play()
            .catch((err) => console.error("Audio play error:", err));
        } else if (Notification.permission === "denied") {
          toast.error("Notifications are blocked. Please enable them in your browser settings to receive message alerts.");
        }

        // Toast notification (optional, remove if you only want browser notifications)
        const senderName = message.senderId.fullName || "Unknown";
        const content = message.text || (message.image ? "Image" : "Audio");
        toast.info(`New message from ${senderName}: ${content}`, {
          duration: 2000,
          style: { background: "#e0f7fa", color: "#0288d1" },
        });
      }
    });

    socket.on("notification", (notification) => {
      console.log("Global notification received:", notification);
      // Since we're handling toast notifications in the newMessage event,
      // we can optionally keep this for other types of notifications
    });

    socket.on("typing", (data) => {
      console.log("Typing event received:", data);
      const { userId, typing } = data;
      const authUserId = useAuthStore.getState().authUser?._id;
      const currentSelectedUser = get().selectedUser;
      if (
        currentSelectedUser &&
        userId === currentSelectedUser._id &&
        userId !== authUserId
      ) {
        set({ isTyping: typing });
      }
    });

    socket.on("chatCleared", ({ userId }) => {
      console.log("Received chatCleared event for userId:", userId);
      const currentSelectedUser = get().selectedUser;
      if (currentSelectedUser?._id === userId && !get().isChatCleared) {
        set({ messages: [], isChatCleared: true });
        get().resetUnreadCount(userId);
        toast.success("Chat has been cleared");
        // Update lastMessage to null for the cleared chat
        set((state) => ({
          users: state.users.map((user) =>
            user._id === userId ? { ...user, lastMessage: null } : user
          ),
        }));
      }
    });

    socket.on("groupUpdated", (updatedGroup) => {
      console.log("Group updated:", updatedGroup);
      const currentSelectedUser = get().selectedUser;
      if (currentSelectedUser?._id === updatedGroup._id) {
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
      const currentSelectedUser = get().selectedUser;
      if (currentSelectedUser?._id === groupId) {
        set({ selectedUser: null, messages: [] });
      }
      set((state) => ({
        groupChats: state.groupChats.filter((g) => g._id !== groupId),
        unreadCounts: {
          ...state.unreadCounts,
          [groupId]: 0,
        },
      }));
    });

    socket.on("userDeleted", (data) => {
      console.log("Received userDeleted event for userId:", data.userId);
      const currentSelectedUser = get().selectedUser;
      set((state) => {
        const updatedUsers = state.users.filter(
          (user) => user._id !== data.userId
        );
        const updatedSelectedUser =
          currentSelectedUser?._id === data.userId ? null : currentSelectedUser;

        toast(`User has deleted their account.`, {
          style: { background: "#e0f7fa", color: "#0288d1" },
        });

        return {
          users: updatedUsers,
          selectedUser: updatedSelectedUser,
          unreadCounts: {
            ...state.unreadCounts,
            [data.userId]: 0,
          },
        };
      });
    });

    socket.on("userRemovedFromChat", ({ chatId, userId }) => {
      console.log(`User ${userId} removed from chat ${chatId}`);
      get().removeUserFromChat(chatId, userId);
      toast.info("A user has left the chat");
    });

    // Handle userOnline and userOffline to update selectedUser and users
    socket.on("userOnline", (userId) => {
      console.log(`userOnline event in useChatStore - userId: ${userId}`);
      const currentSelectedUser = get().selectedUser;
      if (currentSelectedUser && !currentSelectedUser.isGroupChat && currentSelectedUser._id === userId) {
        set((state) => ({
          selectedUser: { ...state.selectedUser, isOnline: true },
          users: state.users.map((user) =>
            user._id === userId ? { ...user, isOnline: true } : user
          ),
        }));
      }
    });

    socket.on("userOffline", (userId) => {
      console.log(`userOffline event in useChatStore - userId: ${userId}`);
      const currentSelectedUser = get().selectedUser;
      if (currentSelectedUser && !currentSelectedUser.isGroupChat && currentSelectedUser._id === userId) {
        set((state) => ({
          selectedUser: { ...state.selectedUser, isOnline: false, updatedAt: new Date() },
          users: state.users.map((user) =>
            user._id === userId ? { ...user, isOnline: false, updatedAt: new Date() } : user
          ),
        }));
      }
    });
  },

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

  incrementUnreadCount: (chatId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [chatId]: (state.unreadCounts[chatId] || 0) + 1,
      },
    }));
  },

  resetUnreadCount: (chatId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [chatId]: 0,
      },
    }));
  },

  subscribeToMessages: () => {
    console.log("subscribeToMessages is now handled globally");
  },

  unsubscribeFromMessages: () => {
    console.log("Unsubscribe not needed with global listeners");
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser, isTyping: false, isChatCleared: false });
    if (selectedUser) {
      get().getMessages(selectedUser._id);
      get().resetUnreadCount(selectedUser._id); // Reset unread count when viewing chat
    } else {
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
        unreadCounts: {
          ...state.unreadCounts,
          [groupId]: 0,
        },
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
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: 0,
      },
    }));
  },
}));