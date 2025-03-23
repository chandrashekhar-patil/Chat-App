// front-end/src/components/CallWindow.jsx
import { useState, useEffect, useRef } from "react";
import { IoMic, IoMicOff, IoCameraReverse, IoCall } from "react-icons/io5";
import { motion } from "framer-motion";
import { IconButton, Typography } from "@mui/material";
import toast from "react-hot-toast";
import AgoraRTC from "agora-rtc-sdk-ng";

const CallWindow = ({
  isCalling,
  callType,
  selectedUser,
  onEndCall,
  isBlocked,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const APP_ID = import.meta.env.VITE_APP_ID;
  const TOKEN = import.meta.env.VITE_TOKEN;
  const CHANNEL = import.meta.env.VITE_CHANNEL;
  const [client] = useState(() =>
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );

  // Start the call when the component mounts and isCalling is true
  useEffect(() => {
    if (!isCalling || !APP_ID || !CHANNEL || isBlocked) {
      if (isBlocked) {
        toast.error("This user is blocked. Cannot initiate call.");
      }
      return;
    }

    const startCall = async () => {
      try {
        await client.join(APP_ID, CHANNEL, TOKEN || null, selectedUser._id);
        if (callType === "voice") {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          setLocalAudioTrack(audioTrack);
          await client.publish([audioTrack]);
          toast.success(`Voice call started with ${selectedUser.fullName}`);
        } else if (callType === "video") {
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
      } catch (error) {
        toast.error(`Failed to start ${callType} call: ${error.message}`);
        handleEndCall();
      }
    };

    startCall();

    return () => {
      handleEndCall();
    };
  }, [isCalling, callType, selectedUser, isBlocked]);

  // Handle mute/unmute
  const handleToggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(!isMuted);
      setIsMuted(!isMuted);
      toast.success(isMuted ? "Unmuted" : "Muted");
    } else {
      toast.error("No audio track available");
    }
  };

  // Handle camera swap
  const handleSwapCamera = async () => {
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
    } else {
      toast.error("No video track available");
    }
  };

  // Handle end call
  const handleEndCall = async () => {
    try {
      if (localVideoTrack) localVideoTrack.stop();
      if (localAudioTrack) localAudioTrack.stop();
      await client.leave();
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setIsMuted(false);
      toast.success("Call ended");
      onEndCall(); // Notify parent to update state
    } catch (error) {
      toast.error("Failed to end call");
    }
  };

  const popupVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  if (!isCalling || isBlocked) return null;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black bg-opacity-85 z-50"
      variants={popupVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="bg-gradient-to-br from-gray-100 to-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200/50">
        <div className="flex flex-col items-center gap-6">
          {callType === "video" && (
            <div className="w-full h-[400px] bg-gray-900 rounded-2xl overflow-hidden shadow-lg relative">
              <div
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 w-40 h-48 bg-gray-800 rounded-xl overflow-hidden shadow-md border border-gray-700/50">
                <div
                  ref={localVideoRef}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          <div className="text-center">
            <Typography
              variant="h5"
              className="text-gray-800 font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            >
              {selectedUser.fullName}
            </Typography>
            <Typography variant="body1" className="text-gray-600 font-medium">
              {callType === "video" ? "Video Call" : "Voice Call"}
            </Typography>
          </div>
          <div className="flex gap-6">
            {callType === "video" && (
              <IconButton
                onClick={handleSwapCamera}
                className="p-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full hover:from-gray-300 hover:to-gray-400 focus:from-gray-400 focus:to-gray-500 transition-all duration-300 shadow-md"
                title="Swap Camera"
              >
                <IoCameraReverse size={28} className="text-gray-800" />
              </IconButton>
            )}
            <IconButton
              onClick={handleToggleMute}
              className="p-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full hover:from-gray-300 hover:to-gray-400 focus:from-gray-400 focus:to-gray-500 transition-all duration-300 shadow-md"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <IoMicOff size={28} className="text-red-600" />
              ) : (
                <IoMic size={28} className="text-gray-800" />
              )}
            </IconButton>
            <IconButton
              onClick={handleEndCall}
              className="p-4 bg-red-700 rounded-full hover:bg-red-600 focus:bg-red-800 transition-colors duration-200 shadow-md"
              title="End Call"
            >
              <IoCall size={28} className="rotate-135 text-white" />
            </IconButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CallWindow;
