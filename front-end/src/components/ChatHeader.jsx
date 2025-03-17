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
import { Menu, MenuItem, IconButton, Typography } from "@mui/material";

const ChatHeader = ({ selectedUser }) => {
  const { authUser, onlineUsers, blockedUsers, socket } = useAuthStore(); // Use global socket from useAuthStore
  const { setSelectedUser, clearChatMessages } = useChatStore();
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
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

  // Use the global socket from useAuthStore for real-time events
  useEffect(() => {
    if (!authUser || !socket) {
      console.log("Auth user or socket not available, skipping event setup");
      return;
    }

    console.log("ChatHeader using socket ID:", socket.id);

    socket.on("incoming_call", (data) => {
      setIncomingCall({ from: data.from, channel: data.channel });
      toast(
        `Incoming ${callType || "video"} call from ${
          selectedUser?.fullName || "Unknown"
        }`,
        { duration: 10000 }
      );
    });

    socket.on("call_accepted", (data) => {
      startCall(callType);
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

    socket.on("getOnlineUsers", (users) => {
      console.log("Online users updated:", users);
    });

    socket.on("chatCleared", ({ userId }) => {
      if (selectedUser?._id === userId) {
        clearChatMessages(userId);
        toast.success("Chat has been cleared");
      }
    });

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("call_rejected");
      socket.off("call_error");
      socket.off("getOnlineUsers");
      socket.off("chatCleared");
    };
  }, [authUser, socket, callType, selectedUser, clearChatMessages]);

  if (!authUser || !selectedUser) {
    return null;
  }

  const isOnline = onlineUsers.includes(selectedUser._id);
  const isBlocked = blockedUsers.includes(selectedUser._id);
  const showOnlineStatus = isOnline && !isBlocked;

  let lastSeenText = null;
  if (!isOnline && selectedUser.updatedAt && !isBlocked) {
    try {
      lastSeenText = `last seen ${formatDistanceToNow(
        new Date(selectedUser.updatedAt),
        { addSuffix: true }
      )}`;
    } catch (error) {
      console.error("Error formatting last seen:", error);
      lastSeenText = "offline";
    }
  } else if (!isOnline && !selectedUser.updatedAt && !isBlocked) {
    lastSeenText = "offline";
  }

  const handleClearChat = async () => {
    if (!selectedUser?._id) {
      toast.error("No user selected to clear chat");
      return;
    }
    try {
      await axiosInstance.post(`/clear-chat/${selectedUser._id}`);
      clearChatMessages(selectedUser._id);
      toast.success("Chat cleared successfully");
      setMenuAnchorEl(null);
    } catch (error) {
      console.error("Error clearing chat:", error);
      toast.error(error.response?.data?.message || "Failed to clear chat");
    }
  };

  const handleBlockUser = async () => {
    try {
      await axiosInstance.post(`/block/${selectedUser._id}`);
      useAuthStore.setState((state) => ({
        blockedUsers: [...state.blockedUsers, selectedUser._id],
      }));
      toast.success(`${selectedUser.fullName} has been blocked`);
      setMenuAnchorEl(null);
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error(error.response?.data?.message || "Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
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
      console.error("Error unblocking user:", error);
      toast.error(error.response?.data?.message || "Failed to unblock user");
    }
  };

  const handleMuteNotifications = () => {
    toast.info("Mute notifications feature is not implemented yet.");
    setMenuAnchorEl(null);
  };

  const handleReportUser = () => {
    toast.info("Report user feature is not implemented yet.");
    setMenuAnchorEl(null);
  };

  const startCall = async (type) => {
    if (!APP_ID || !CHANNEL) {
      toast.error("Agora configuration is missing.");
      return;
    }
    if (isBlocked || isCalling) {
      toast.error(
        isBlocked ? "Cannot call a blocked user" : "Already in a call"
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
      console.error(`${type} call error:`, error);
      toast.error(`Failed to start ${type} call`);
      setIsCalling(false);
      setCallType(null);
    }
  };

  const initiateCall = (type) => {
    if (!socket) return;
    socket.emit("call", {
      from: authUser._id,
      to: selectedUser._id,
      channel: CHANNEL,
    });
    setIsCalling(true);
    setCallType(type);
  };

  const acceptCall = () => {
    if (!socket || !incomingCall) return;
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
      console.error("Error ending call:", error);
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
        console.error("Error swapping camera:", error);
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
            onClick={() => setShowProfileModal(true)}
          >
            <div className="relative">
              <img
                src={selectedUser.profilePic || "/avatar.png"}
                alt={selectedUser.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
              {showOnlineStatus && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div>
              <h3 className="text-gray-800 font-medium truncate max-w-[150px] md:max-w-[250px]">
                {selectedUser.fullName}
              </h3>
              <p
                className={`text-sm ${
                  showOnlineStatus ? "text-green-500" : "text-gray-500"
                }`}
              >
                {isCalling
                  ? "Calling..."
                  : showOnlineStatus
                  ? "online"
                  : lastSeenText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            <IoVideocam size={24} />
          </IconButton>
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
                setShowProfileModal(true);
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
              View Profile
            </MenuItem>
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
              Report User
            </MenuItem>
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
            {isCalling && (
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
        {isCalling && (
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
                  <div className="w-full h-64 bg-gray-800 rounded-lg overflow-hidden shadow-inner">
                    <div ref={remoteVideoRef} className="w-full h-full" />
                  </div>
                )}
                {callType === "video" && (
                  <div className="absolute bottom-24 right-8 w-28 h-36 bg-gray-700 rounded-lg overflow-hidden shadow-md">
                    <div ref={localVideoRef} className="w-full h-full" />
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
                    className="p-3 bg-red-600 rounded-full hover:bg-red-700 focus:bg-red-800 transition-colors duration-200"
                    title="End Call"
                  >
                    <IoCall size={24} className="rotate-135 text-white" />
                  </IconButton>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incomingCall && (
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

      {showProfileModal && (
        <ProfileModal
          user={selectedUser}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
};

export default ChatHeader;
