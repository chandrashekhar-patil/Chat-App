// front-end/src/components/ChatHeader.jsx
import {
  IoChevronBack,
  IoEllipsisVertical,
  IoCall,
  IoVideocam,
  IoMic,
  IoMicOff,
  IoCameraReverse,
  IoBan,
  IoTrash,
  IoNotificationsOff,
  IoFlag,
  IoPersonCircleOutline,
} from "react-icons/io5";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import AgoraRTC from "agora-rtc-sdk-ng";
import ProfileModal from "./ProfileModal";
import GroupInfoModal from "./GroupInfoModal";
import { Menu, MenuItem, IconButton, Typography } from "@mui/material";
import { FcVideoCall } from "react-icons/fc";

// Request Notification Permission
const requestNotificationPermission = () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications");
    return;
  }
  if (
    Notification.permission !== "granted" &&
    Notification.permission !== "denied"
  ) {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Notification permission granted");
      } else {
        console.log("Notification permission denied");
      }
    });
  }
};

const ChatHeader = ({ selectedUser }) => {
  const { authUser, onlineUsers, blockedUsers, socket } = useAuthStore();
  const { setSelectedUser, clearChatMessages } = useChatStore();
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [incomingCall, setIncomingCall] = useState(null);

  const APP_ID = import.meta.env.VITE_APP_ID;
  const TOKEN = import.meta.env.VITE_TOKEN;
  const CHANNEL = import.meta.env.VITE_CHANNEL;

  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);

  useEffect(() => {
    // Request notification permission on component mount
    requestNotificationPermission();

    if (!authUser || !socket) return;

    socket.on("incoming_call", (data) => {
      if (
        data.from === selectedUser?._id &&
        !blockedUsers.includes(data.from)
      ) {
        setIncomingCall({ from: data.from, channel: data.channel });
        if (Notification.permission === "granted") {
          const notification = new Notification(
            `Incoming ${callType || "Video"} Call`,
            {
              body: `From ${selectedUser?.fullName || "Unknown"}`,
              icon: selectedUser?.profilePic || "/avatar.png",
              tag: `call-${data.from}`,
            }
          );
          notification.onclick = () => window.focus(); // Focus window on click
          const audio = new Audio("/notification.mp3"); // Add sound file in public folder
          audio.play().catch((err) => console.error("Audio play error:", err));
        }
        toast(
          `Incoming ${callType || "video"} call from ${
            selectedUser?.fullName || "Unknown"
          }`,
          {
            duration: 10000,
          }
        );
      }
    });

    socket.on("call_accepted", (data) => {
      if (data.from === selectedUser?._id) {
        startCall(callType);
      }
    });

    socket.on("call_rejected", () => {
      toast.error(`Call rejected by ${selectedUser?.fullName || "Unknown"}`);
      setIsCalling(false);
      setCallType(null);
    });

    socket.on("call_error", (data) => {
      toast.error(data.message);
      setIsCalling(false);
      setCallType(null);
    });

    socket.on("chatCleared", ({ userId }) => {
      if (selectedUser?._id === userId) {
        clearChatMessages(userId);
        toast.success("Chat has been cleared, group remains active");
      }
    });

    socket.on("newMessage", (message) => {
      if (
        (message.senderId._id === selectedUser?._id &&
          message.receiverId === authUser._id) ||
        message.chatId === selectedUser?._id
      ) {
        if (!blockedUsers.includes(message.senderId._id)) {
          const senderName = message.senderId.fullName || "Unknown";
          const content = message.text || (message.image ? "Image" : "Audio");
          if (Notification.permission === "granted" && document.hidden) {
            const notification = new Notification(
              `New Message from ${senderName}`,
              {
                body: content,
                icon: message.senderId.profilePic || "/avatar.png",
                tag: message._id,
              }
            );
            notification.onclick = () => window.focus();
            const audio = new Audio("/notification.mp3");
            audio
              .play()
              .catch((err) => console.error("Audio play error:", err));
          }
          toast(`New message from ${senderName}: ${content}`, {
            duration: 5000,
          });
        }
      }
    });

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("call_rejected");
      socket.off("call_error");
      socket.off("chatCleared");
      socket.off("newMessage");
    };
  }, [
    authUser,
    socket,
    callType,
    selectedUser,
    clearChatMessages,
    blockedUsers,
  ]);

  if (!authUser || !selectedUser) return null;

  const isGroupChat = selectedUser.isGroupChat;
  const isOnline = !isGroupChat && onlineUsers.includes(selectedUser._id);
  const isBlocked = !isGroupChat && blockedUsers.includes(selectedUser._id);
  const showOnlineStatus = isOnline && !isBlocked;

  let statusText = "";
  if (isGroupChat) {
    statusText = `${selectedUser.members.length} members`;
  } else if (!isOnline && selectedUser.updatedAt && !isBlocked) {
    statusText = `last seen ${formatDistanceToNow(
      new Date(selectedUser.updatedAt),
      { addSuffix: true }
    )}`;
  } else if (!isOnline && !isBlocked) {
    statusText = "offline";
  } else if (showOnlineStatus) {
    statusText = "online";
  } else if (isBlocked) {
    statusText = "blocked";
  }

  const handleClearChat = async () => {
    if (!selectedUser?._id) {
      toast.error("No chat selected to clear");
      return;
    }
    try {
      const endpoint = isGroupChat
        ? `/group-chats/${selectedUser._id}/clear`
        : `/clear-chat/${selectedUser._id}`;
      await axiosInstance.post(endpoint);
      clearChatMessages(selectedUser._id);
      toast.success("Chat cleared successfully");
      setMenuAnchorEl(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear chat");
    }
  };

  const handleBlockUser = async () => {
    if (isGroupChat) {
      toast.info("Blocking is not applicable to groups");
      setMenuAnchorEl(null);
      return;
    }
    try {
      await axiosInstance.post(`/block/${selectedUser._id}`);
      useAuthStore.setState((state) => ({
        blockedUsers: [...state.blockedUsers, selectedUser._id],
      }));
      toast.success(`${selectedUser.fullName} has been blocked`);
      setMenuAnchorEl(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
    if (isGroupChat) {
      toast.info("Unblocking is not applicable to groups");
      setMenuAnchorEl(null);
      return;
    }
    try {
      await axiosInstance.post(`/unblock/${selectedUser._id}`);
      useAuthStore.setState((state) => ({
        blockedUsers: state.blockedUsers.filter(
          (id) => id !== selectedUser._id
        ),
      }));
      toast.success(`${selectedUser.fullName} has been unblocked`);
      setMenuAnchorEl(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unblock user");
    }
  };

  const handleMuteNotifications = () => {
    toast.info("Mute notifications feature is not implemented yet.");
    setMenuAnchorEl(null);
  };

  const handleReportUser = () => {
    if (isGroupChat) {
      toast.info("Reporting a group is not implemented yet.");
    } else {
      toast.info("Report user feature is not implemented yet.");
    }
    setMenuAnchorEl(null);
  };

  const initiateCall = (type) => {
    if (isGroupChat) {
      toast.info("Calls are not supported for group chats yet.");
      return;
    }
    if (!socket || !selectedUser?._id || isBlocked) {
      toast.error(
        isBlocked
          ? "Cannot call a blocked user"
          : "Socket or user not available"
      );
      return;
    }
    socket.emit("call", {
      from: authUser._id,
      to: selectedUser._id,
      channel: CHANNEL,
    });
    setIsCalling(true);
    setCallType(type);
  };

  const startCall = async (type) => {
    if (isGroupChat || !APP_ID || !CHANNEL || isBlocked || isCalling) {
      toast.error(
        isGroupChat
          ? "Calls not supported for groups"
          : !APP_ID || !CHANNEL
          ? "Agora configuration missing"
          : isBlocked
          ? "Cannot call a blocked user"
          : "Already in a call"
      );
      return;
    }
    setIsCalling(true);
    setCallType(type);

    try {
      await client.join(APP_ID, CHANNEL, TOKEN || null, authUser._id);
      if (type === "voice") {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(audioTrack);
        await client.publish([audioTrack]);
        toast.success(`Voice call started with ${selectedUser.fullName}`);
      } else if (type === "video") {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          facingMode: "user",
        });
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);
        videoTrack.play(localVideoRef.current);
        await client.publish([videoTrack, audioTrack]);
        toast.success(`Video call started with ${selectedUser.fullName}`);
      }
    } catch (error) {
      toast.error(`Failed to start ${type} call`);
      setIsCalling(false);
      setCallType(null);
    }
  };

  const acceptCall = () => {
    if (!socket || !incomingCall || isBlocked) {
      toast.error(
        isBlocked
          ? "Cannot accept call from a blocked user"
          : "Socket or call not available"
      );
      return;
    }
    socket.emit("accept_call", {
      from: authUser._id,
      to: incomingCall.from,
      channel: incomingCall.channel,
    });
    setIncomingCall(null);
    startCall(callType || "video");
  };

  const rejectCall = () => {
    if (!socket || !incomingCall) return;
    socket.emit("reject_call", {
      from: authUser._id,
      to: incomingCall.from,
    });
    setIncomingCall(null);
    toast("Call rejected");
  };

  const endCall = async () => {
    try {
      if (localVideoTrack) localVideoTrack.stop();
      if (localAudioTrack) localAudioTrack.stop();
      await client.leave();
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setIsCalling(false);
      setCallType(null);
      setIsMuted(false);
      toast.success("Call ended");
    } catch (error) {
      toast.error("Failed to end call");
    }
  };

  useEffect(() => {
    client.on("user-published", async (remoteUser, mediaType) => {
      await client.subscribe(remoteUser, mediaType);
      if (mediaType === "video" && remoteVideoRef.current) {
        remoteUser.videoTrack?.play(remoteVideoRef.current);
      }
      if (mediaType === "audio") {
        remoteUser.audioTrack?.play();
      }
    });

    client.on("user-unpublished", (user) => {
      if (user.videoTrack) user.videoTrack.stop();
      if (user.audioTrack) user.audioTrack.stop();
    });

    return () => {
      client.off("user-published");
      client.off("user-unpublished");
    };
  }, [client]);

  const toggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(!isMuted);
      setIsMuted(!isMuted);
      toast.success(isMuted ? "Unmuted" : "Muted");
    }
  };

  const swapCamera = async () => {
    if (localVideoTrack) {
      try {
        await localVideoTrack.setDevice(
          isFrontCamera ? { facingMode: "environment" } : { facingMode: "user" }
        );
        setIsFrontCamera(!isFrontCamera);
        toast.success(`Switched to ${isFrontCamera ? "back" : "front"} camera`);
      } catch (error) {
        toast.error("Failed to swap camera");
      }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const popupVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.1 } },
  };

  return (
    <>
      <motion.div
        className="flex items-center justify-between p-4 bg-gray-200 shadow-sm"
        variants={headerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedUser(null)}
            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 focus:bg-gray-200 transition-colors duration-200"
          >
            <IoChevronBack size={24} />
          </button>
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() =>
              isGroupChat
                ? setShowGroupInfoModal(true)
                : setShowProfileModal(true)
            }
          >
            <div className="relative">
              {isGroupChat ? (
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">
                    {selectedUser.name[0].toUpperCase()}
                  </span>
                </div>
              ) : (
                <img
                  src={selectedUser.profilePic || "/avatar.png"}
                  alt={selectedUser.fullName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              {showOnlineStatus && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div>
              <h3 className="text-gray-800 font-medium truncate max-w-[150px] md:max-w-[250px]">
                {isGroupChat ? selectedUser.name : selectedUser.fullName}
              </h3>
              <p
                className={`text-sm ${
                  showOnlineStatus ? "text-green-500" : "text-gray-500"
                }`}
              >
                {isCalling ? "Calling..." : statusText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isGroupChat && (
            <>
              <IconButton
                onClick={() => initiateCall("voice")}
                className={`text-gray-600 hover:bg-gray-100 focus:bg-gray-200 rounded-full transition-all duration-200 transform hover:scale-105 focus:scale-105 ${
                  isBlocked || isCalling ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={isBlocked || isCalling}
                title="Voice Call"
              >
                <IoCall size={24} />
              </IconButton>
              <IconButton
                onClick={() => initiateCall("video")}
                className={`text-gray-600 hover:bg-gray-100 focus:bg-gray-200 rounded-full transition-all duration-200 transform hover:scale-105 focus:scale-105 ${
                  isBlocked || isCalling ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={isBlocked || isCalling}
                title="Video Call"
              >
                <FcVideoCall size={24} />
              </IconButton>
            </>
          )}
          <IconButton
            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
            className="text-gray-600 hover:bg-gray-100 focus:bg-gray-200 rounded-full transition-all duration-200 transform hover:scale-105 focus:scale-105"
          >
            <IoEllipsisVertical size={24} />
          </IconButton>

          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={() => setMenuAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
              paper: {
                elevation: 3,
                sx: {
                  mt: 1,
                  borderRadius: 2,
                  minWidth: 200,
                  backgroundColor: "white",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                },
              },
            }}
          >
            <MenuItem
              onClick={() => {
                isGroupChat
                  ? setShowGroupInfoModal(true)
                  : setShowProfileModal(true);
                setMenuAnchorEl(null);
              }}
              sx={{
                gap: 2,
                color: "gray.700",
                "&:hover": { bgcolor: "gray.100" },
                "&:focus": { bgcolor: "gray.200" },
              }}
            >
              <IoPersonCircleOutline size={20} />
              {isGroupChat ? "Group Info" : "View Profile"}
            </MenuItem>
            {!isGroupChat && (
              <>
                <MenuItem
                  onClick={() => {
                    initiateCall("voice");
                    setMenuAnchorEl(null);
                  }}
                  disabled={isBlocked || isCalling}
                  sx={{
                    gap: 2,
                    color: "gray.700",
                    "&:hover": { bgcolor: "gray.100" },
                    "&:focus": { bgcolor: "gray.200" },
                    opacity: isBlocked || isCalling ? 0.5 : 1,
                  }}
                >
                  <IoCall size={20} />
                  Voice Call
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    initiateCall("video");
                    setMenuAnchorEl(null);
                  }}
                  disabled={isBlocked || isCalling}
                  sx={{
                    gap: 2,
                    color: "gray.700",
                    "&:hover": { bgcolor: "gray.100" },
                    "&:focus": { bgcolor: "gray.200" },
                    opacity: isBlocked || isCalling ? 0.5 : 1,
                  }}
                >
                  <IoVideocam size={20} />
                  Video Call
                </MenuItem>
              </>
            )}
            <MenuItem
              onClick={handleClearChat}
              sx={{
                gap: 2,
                color: "gray.700",
                "&:hover": { bgcolor: "gray.100" },
                "&:focus": { bgcolor: "gray.200" },
              }}
            >
              <IoTrash size={20} />
              Clear Chat
            </MenuItem>
            <MenuItem
              onClick={handleMuteNotifications}
              sx={{
                gap: 2,
                color: "gray.700",
                "&:hover": { bgcolor: "gray.100" },
                "&:focus": { bgcolor: "gray.200" },
              }}
            >
              <IoNotificationsOff size={20} />
              Mute Notifications
            </MenuItem>
            <MenuItem
              onClick={handleReportUser}
              sx={{
                gap: 2,
                color: "gray.700",
                "&:hover": { bgcolor: "gray.100" },
                "&:focus": { bgcolor: "gray.200" },
              }}
            >
              <IoFlag size={20} />
              Report {isGroupChat ? "Group" : "User"}
            </MenuItem>
            {!isGroupChat && (
              <MenuItem
                onClick={isBlocked ? handleUnblockUser : handleBlockUser}
                sx={{
                  gap: 2,
                  color: "red.600",
                  "&:hover": { bgcolor: "red.50" },
                  "&:focus": { bgcolor: "red.100" },
                }}
              >
                <IoBan size={20} />
                {isBlocked ? "Unblock" : "Block"}
              </MenuItem>
            )}
            {isCalling && !isGroupChat && (
              <MenuItem
                onClick={endCall}
                sx={{
                  gap: 2,
                  color: "white",
                  backgroundColor: "red.600",
                  "&:hover": { bgcolor: "red.700", color: "white" },
                  "&:focus": { bgcolor: "red.800", color: "white" },
                }}
              >
                <IoCall size={20} className="rotate-135" />
                End Call
              </MenuItem>
            )}
          </Menu>
        </div>
      </motion.div>

      <AnimatePresence>
        {isCalling && !isGroupChat && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50"
            variants={popupVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex flex-col items-center gap-4">
                {callType === "video" && (
                  <div className="w-full h-64 bg-gray-800 rounded-lg overflow-hidden shadow-inner relative">
                    <div
                      ref={remoteVideoRef}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 right-4 w-28 h-36 bg-gray-700 rounded-lg overflow-hidden shadow-md">
                      <div
                        ref={localVideoRef}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                <div className="text-center">
                  <Typography
                    variant="h6"
                    className="text-gray-800 font-semibold"
                  >
                    {selectedUser.fullName}
                  </Typography>
                  <Typography variant="body2" className="text-gray-500">
                    {callType === "video" ? "Video Call" : "Voice Call"}
                  </Typography>
                </div>
                <div className="flex gap-4">
                  {callType === "video" && (
                    <IconButton
                      onClick={swapCamera}
                      className="p-3 bg-gray-200 rounded-full hover:bg-gray-300 focus:bg-gray-400 transition-colors duration-200"
                      title="Swap Camera"
                    >
                      <IoCameraReverse size={24} className="text-gray-700" />
                    </IconButton>
                  )}
                  <IconButton
                    onClick={toggleMute}
                    className="p-3 bg-gray-200 rounded-full hover:bg-gray-300 focus:bg-gray-400 transition-colors duration-200"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <IoMicOff size={24} className="text-red-500" />
                    ) : (
                      <IoMic size={24} className="text-gray-700" />
                    )}
                  </IconButton>
                  <IconButton
                    onClick={endCall}
                    className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 focus:bg-red-800 focus:bg-red-800 transition-colors duration-200 shadow-md"
                    title="End Call"
                  >
                    <IoCall size={24} className="rotate-135 text-red" />
                  </IconButton>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incomingCall && !isGroupChat && !isBlocked && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50"
            variants={popupVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex flex-col items-center gap-4">
                <Typography
                  variant="h6"
                  className="text-gray-800 font-semibold"
                >
                  Incoming Call
                </Typography>
                <Typography variant="body2" className="text-gray-500">
                  From {selectedUser.fullName}
                </Typography>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={acceptCall}
                    className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 focus:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 shadow-md"
                  >
                    Accept
                  </button>
                  <button
                    onClick={rejectCall}
                    className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 shadow-md"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showProfileModal && !isGroupChat && (
        <ProfileModal
          user={selectedUser}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showGroupInfoModal && isGroupChat && (
        <GroupInfoModal
          group={selectedUser}
          onClose={() => setShowGroupInfoModal(false)}
        />
      )}
    </>
  );
};

export default ChatHeader;
