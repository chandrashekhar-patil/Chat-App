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

// Main ChatContainer component
const ChatContainer = () => {
  // State from stores
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    isTyping, // Reflects the other user's typing status
    isChatCleared,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  // Debug messages state changes
  useEffect(() => {
    if (messages.length > 0 && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]); // Re-render when messages change

  // Debug mount/unmount
  useEffect(() => {
    console.log("ChatContainer mounted");
    return () => console.log("ChatContainer unmounted");
  }, []);

  // Fetch messages when a user is selected
  const fetchMessages = useCallback(() => {
    if (selectedUser?._id && !isChatCleared) {
      console.log("Fetching messages for user:", selectedUser._id);
      getMessages(selectedUser._id);
    } else {
      console.log("Skipping fetchMessages: selectedUser or isChatCleared", {
        selectedUser,
        isChatCleared,
      });
    }
  }, [selectedUser?._id, getMessages, isChatCleared]);

  // Subscribe to real-time updates when a user is selected
  useEffect(() => {
    if (!selectedUser?._id) return;

    console.log("Setting up subscriptions for user:", selectedUser._id);
    fetchMessages();
    subscribeToMessages();

    return () => {
      console.log("Unsubscribing from messages for user:", selectedUser._id);
      unsubscribeFromMessages();
    };
  }, [
    selectedUser?._id,
    fetchMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  // Scroll to the latest message when messages update
  useEffect(() => {
    if (messages.length > 0 && messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Memoized function to determine avatar based on sender
  const getAvatar = useMemo(
    () => (message) =>
      message.senderId === authUser._id
        ? authUser.profilePic || "/avatar.png"
        : selectedUser?.profilePic || "/avatar.png",
    [authUser, selectedUser]
  );

  // Local state for audio playback
  const [playingId, setPlayingId] = useState(null);
  const [dropdownAnchorEl, setDropdownAnchorEl] = useState(null);
  const [progress, setProgress] = useState({});
  const [durations, setDurations] = useState({});
  const [isLoadingAudio, setIsLoadingAudio] = useState({});
  const audioRefs = useRef({});

  // Handle play/pause for audio messages
  const handlePlayPause = (messageId, audioUrl) => {
    // Pause any currently playing audio
    if (playingId && playingId !== messageId && audioRefs.current[playingId]) {
      audioRefs.current[playingId].pause();
      audioRefs.current[playingId].currentTime = 0;
      setProgress((prev) => ({ ...prev, [playingId]: 0 }));
      setPlayingId(null);
    }

    // Toggle play/pause for the current audio
    if (playingId === messageId) {
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].pause();
        audioRefs.current[messageId].currentTime = 0;
        setProgress((prev) => ({ ...prev, [messageId]: 0 }));
      }
      setPlayingId(null);
    } else {
      setIsLoadingAudio((prev) => ({ ...prev, [messageId]: true }));
      console.log(
        `Starting to load audio for message ${messageId}: ${audioUrl}`
      );
      const audio = new Audio(audioUrl);
      audioRefs.current[messageId] = audio;

      audio.addEventListener("loadedmetadata", () => {
        const duration = audio.duration;
        console.log(
          `Metadata loaded for message ${messageId}, duration: ${duration}`
        );
        if (isFinite(duration) && !isNaN(duration) && duration > 0) {
          setDurations((prev) => ({ ...prev, [messageId]: duration }));
        } else {
          console.log(
            `Invalid duration (${duration}) for message ${messageId}, using 0`
          );
          setDurations((prev) => ({ ...prev, [messageId]: 0 }));
        }
        setIsLoadingAudio((prev) => ({ ...prev, [messageId]: false }));
      });

      audio.addEventListener("error", (e) => {
        console.error(`Error loading audio for message ${messageId}:`, e);
        setDurations((prev) => ({ ...prev, [messageId]: 0 }));
        setIsLoadingAudio((prev) => ({ ...prev, [messageId]: false }));
      });

      audio.addEventListener("timeupdate", () => {
        const duration = audioRefs.current[messageId]?.duration || 0;
        if (duration > 0) {
          const progressPercent = (audio.currentTime / duration) * 100;
          setProgress((prev) => ({ ...prev, [messageId]: progressPercent }));
        } else {
          setProgress((prev) => ({ ...prev, [messageId]: 0 }));
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

  // Menu handlers for audio messages
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

  // Format audio duration
  const formatDuration = (duration) => {
    if (!duration || !isFinite(duration) || isNaN(duration)) return null;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Check if a URL is an image
  const isImageUrl = (url) => /\.(png|jpg|jpeg|gif)$/i.test(url);

  // Show loading skeleton while fetching messages
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
          messages.map((message, index) => (
            <div
              key={message._id || `message-${index}`}
              className={`chat ${
                message.senderId === authUser._id ? "chat-end" : "chat-start"
              }`}
              ref={index === messages.length - 1 ? messageEndRef : null}
            >
              <div className="chat-image avatar">
                <div className="size-7 rounded-full border">
                  <img src={getAvatar(message)} alt="profile pic" />
                </div>
              </div>
              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>
              <div
                className={`chat-bubble ${
                  message.senderId === authUser._id
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
                        "&:hover": {
                          bgcolor: "rgba(255, 255, 255, 0.2)",
                        },
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
                              borderColor:
                                message.senderId === authUser._id
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
                {message.text && <p className="p-0 rounded">{message.text}</p>}
              </div>
            </div>
          ))
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
