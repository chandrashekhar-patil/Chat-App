import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect, useRef, useCallback, useMemo } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    addMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  // Fetch messages when the selected user changes
  const fetchMessages = useCallback(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
    }
  }, [selectedUser?._id, getMessages]);

  // Subscribe & Unsubscribe logic
  useEffect(() => {
    if (!selectedUser?._id) return;

    fetchMessages();
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser?._id, fetchMessages, subscribeToMessages, unsubscribeFromMessages]);

  // Scroll to the latest message when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Get the correct avatar for each message
  const getAvatar = useMemo(
    () => (message) =>
      message.senderId === authUser._id
        ? authUser.profilePic || "/avatar.png"
        : selectedUser?.profilePic || "/avatar.png",
    [authUser, selectedUser]
  );

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message._id}
            className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
            ref={index === messages.length - 1 ? messageEndRef : null} // Set ref only on the last message
          >
            {/* User Avatar */}
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img src={getAvatar(message)} alt="profile pic" />
              </div>
            </div>

            {/* Message Content */}
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>

            <div className="chat-bubble flex flex-col">
              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}
              {message.text && <p>{message.text}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Message Input Component */}
      <MessageInput onSendMessage={addMessage} />
    </div>
  );
};

export default ChatContainer;
