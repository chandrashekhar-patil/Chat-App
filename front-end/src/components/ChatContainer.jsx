// front-end/src/components/ChatContainer.jsx
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { formatMessageTime } from "../lib/utils";
import {
  IconButton,
  LinearProgress,
  Box,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Pause from "@mui/icons-material/Pause";
import MoreVert from "@mui/icons-material/MoreVert";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    isTyping,
    isChatCleared,
    clearChatMessages,
  } = useChatStore();
  const { authUser, socket } = useAuthStore();
  const messageEndRef = useRef(null);

  const fetchMessages = useCallback(() => {
    if (selectedUser?._id && !isChatCleared) {
      console.log("Fetching messages for user:", selectedUser._id);
      getMessages(selectedUser._id);
    }
  }, [selectedUser?._id, getMessages, isChatCleared]);

  useEffect(() => {
    if (!authUser?._id || !selectedUser?._id || !socket) return;

    fetchMessages();

    socket.on("newMessage", (message) => {
      if (
        (message.senderId._id === selectedUser._id && message.receiverId === authUser._id) ||
        (message.senderId._id === authUser._id && message.receiverId === selectedUser._id) ||
        (message.chatId === selectedUser._id)
      ) {
        useChatStore.setState((state) => ({
          messages: [...state.messages, message],
        }));
      }
    });

    socket.on("chatCleared", ({ userId }) => {
      if (selectedUser?._id === userId) {
        clearChatMessages(userId);
      }
    });

    return () => {
      socket.off("newMessage");
      socket.off("chatCleared");
    };
  }, [authUser?._id, selectedUser?._id, socket, fetchMessages, clearChatMessages]);

  useEffect(() => {
    if (messages.length > 0 && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const getAvatar = useMemo(
    () => (message) => {
      const isSender = message.senderId._id === authUser._id;
      return isSender
        ? authUser.profilePic || "/avatar.png"
        : selectedUser?.profilePic || "/avatar.png";
    },
    [authUser, selectedUser]
  );

  const getSenderName = useMemo(
    () => (message) => {
      if (!selectedUser?.isGroupChat) return null;
      if (typeof message.senderId === "object" && message.senderId.fullName) {
        return message.senderId.fullName;
      }
      const sender = selectedUser?.members?.find(
        (m) => m._id === message.senderId
      );
      return sender?.fullName || "Unknown";
    },
    [selectedUser]
  );

  const [playingId, setPlayingId] = useState(null);
  const [dropdownAnchorEl, setDropdownAnchorEl] = useState(null);
  const [progress, setProgress] = useState({});
  const [durations, setDurations] = useState({});
  const [isLoadingAudio, setIsLoadingAudio] = useState({});
  const audioRefs = useRef({});

  const handlePlayPause = (messageId, audioUrl) => {
    if (playingId && playingId !== messageId && audioRefs.current[playingId]) {
      audioRefs.current[playingId].pause();
      audioRefs.current[playingId].currentTime = 0;
      setProgress((prev) => ({ ...prev, [playingId]: 0 }));
      setPlayingId(null);
    }
    if (playingId === messageId) {
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].pause();
        audioRefs.current[messageId].currentTime = 0;
        setProgress((prev) => ({ ...prev, [messageId]: 0 }));
      }
      setPlayingId(null);
    } else {
      setIsLoadingAudio((prev) => ({ ...prev, [messageId]: true }));
      const audio = new Audio(audioUrl);
      audioRefs.current[messageId] = audio;

      audio.addEventListener("loadedmetadata", () => {
        const duration = audio.duration;
        setDurations((prev) => ({ ...prev, [messageId]: duration }));
        setIsLoadingAudio((prev) => ({ ...prev, [messageId]: false }));
      });

      audio.addEventListener("timeupdate", () => {
        const duration = audioRefs.current[messageId]?.duration || 0;
        if (duration > 0) {
          const progressPercent = (audio.currentTime / duration) * 100;
          setProgress((prev) => ({ ...prev, [messageId]: progressPercent }));
        }
      });

      audio.play().catch((error) => {
        console.error(`Error playing audio for message ${messageId}:`, error);
        setIsLoadingAudio((prev) => ({ ...prev, [messageId]: false }));
      });
      setPlayingId(messageId);
      audio.onended = () => {
        setPlayingId(null);
        setDropdownAnchorEl(null);
        setProgress((prev) => ({ ...prev, [messageId]: 0 }));
      };
    }
  };

  const handleMenuOpen = (event, messageId) => {
    setDropdownAnchorEl({ element: event.currentTarget, id: messageId });
  };

  const handleMenuClose = () => {
    setDropdownAnchorEl(null);
  };

  const handleMute = (messageId) => {
    if (audioRefs.current[messageId]) {
      audioRefs.current[messageId].pause();
      audioRefs.current[messageId].currentTime = 0;
      setProgress((prev) => ({ ...prev, [messageId]: 0 }));
    }
    setPlayingId(null);
    setDropdownAnchorEl(null);
  };

  const formatDuration = (duration) => {
    if (!duration || !isFinite(duration) || isNaN(duration)) return null;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const isImageUrl = (url) => /\.(png|jpg|jpeg|gif)$/i.test(url);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader selectedUser={selectedUser} />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader selectedUser={selectedUser} />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">No messages yet</div>
        ) : (
          messages.map((message, index) => {
            const isSender = message.senderId._id === authUser._id;
            return (
              <div
                key={message._id || `message-${index}`}
                className={`chat ${isSender ? "chat-end" : "chat-start"}`}
                ref={index === messages.length - 1 ? messageEndRef : null}
              >
                <div className="chat-image avatar">
                  <div className="size-7 rounded-full border">
                    <img src={getAvatar(message)} alt="profile pic" />
                  </div>
                </div>
                <div className="chat-header mb-1 flex items-center gap-2">
                  {selectedUser?.isGroupChat && (
                    <span className="text-sm font-medium text-gray-600">
                      {getSenderName(message)}
                    </span>
                  )}
                  <time className="text-xs opacity-50">
                    {formatMessageTime(message.createdAt)}
                  </time>
                </div>
                <div
                  className={`chat-bubble ${
                    isSender
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  } flex flex-col ${
                    message.audio && !isImageUrl(message.audio)
                      ? ""
                      : "p-3 rounded-lg"
                  }`}
                  style={{
                    backgroundColor:
                      message.audio && isImageUrl(message.audio) ? "white" : "",
                  }}
                >
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Attachment"
                      className="sm:max-w-[200px] rounded-md mb-2"
                    />
                  )}
                  {message.audio &&
                    (isImageUrl(message.audio) ? (
                      <img
                        src={message.audio}
                        alt="Attachment from audio field"
                        className="sm:max-w-[200px] rounded-md mb-2"
                        style={{ backgroundColor: "white" }}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          width: "100%",
                          p: 1,
                          borderRadius: 2,
                          bgcolor: "rgba(255, 255, 255, 0.1)",
                          transition: "background-color 0.3s",
                          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
                        }}
                      >
                        <IconButton
                          onClick={() =>
                            handlePlayPause(message._id, message.audio)
                          }
                          color="inherit"
                          size="medium"
                          sx={{
                            bgcolor: "rgba(255, 255, 255, 0.3)",
                            "&:hover": {
                              bgcolor: "rgba(255, 255, 255, 0.5)",
                              transform: "scale(1.1)",
                            },
                            transition: "all 0.3s",
                            borderRadius: "50%",
                          }}
                          disabled={isLoadingAudio[message._id]}
                        >
                          {playingId === message._id ? (
                            <Pause sx={{ fontSize: 24 }} />
                          ) : (
                            <PlayArrow sx={{ fontSize: 24 }} />
                          )}
                        </IconButton>
                        <Box
                          sx={{
                            flex: 1,
                            position: "relative",
                            minHeight: 24,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {isLoadingAudio[message._id] ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                border: "3px solid",
                                borderColor: isSender
                                  ? "white transparent white transparent"
                                  : "white transparent white transparent",
                                borderRadius: "50%",
                                display: "inline-block",
                              }}
                            />
                          ) : (
                            <LinearProgress
                              variant="determinate"
                              value={
                                durations[message._id] > 0
                                  ? progress[message._id] || 0
                                  : 0
                              }
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: "rgba(255, 255, 255, 0.2)",
                                "& .MuiLinearProgress-bar": {
                                  background:
                                    "linear-gradient(to right, #ff6f61, #ff9f43)",
                                  borderRadius: 4,
                                },
                              }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            ml: 1,
                            color: "white",
                            fontWeight: 500,
                            fontSize: "10px",
                          }}
                        >
                          {isLoadingAudio[message._id]
                            ? null
                            : formatDuration(durations[message._id])}
                        </Typography>
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, message._id)}
                          size="small"
                          color="inherit"
                          disabled={isLoadingAudio[message._id]}
                          sx={{
                            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                        <Menu
                          anchorEl={dropdownAnchorEl?.element}
                          open={dropdownAnchorEl?.id === message._id}
                          onClose={handleMenuClose}
                          anchorOrigin={{
                            vertical: "top",
                            horizontal: "right",
                          }}
                          transformOrigin={{
                            vertical: "top",
                            horizontal: "right",
                          }}
                        >
                          <MenuItem onClick={() => handleMute(message._id)}>
                            Mute
                          </MenuItem>
                        </Menu>
                      </Box>
                    ))}
                  {message.text && (
                    <p className="p-0 rounded">{message.text}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isTyping && selectedUser && selectedUser._id !== authUser._id && (
          <motion.div
            className="chat chat-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={selectedUser.profilePic || "/avatar.png"}
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-bubble bg-gray-200 text-gray-800 flex items-center p-3 rounded-lg">
              <span className="mr-2">Typing</span>
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                .
              </motion.span>
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
              >
                .
              </motion.div>
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
              >
                .
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
      <MessageInput />
    </div>
  );
};

export default ChatContainer;