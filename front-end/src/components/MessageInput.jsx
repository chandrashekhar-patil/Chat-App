// front-end/src/components/MessageInput.jsx
import { useRef, useState, useEffect, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, X, Mic, Smile } from "lucide-react";
import toast from "react-hot-toast";
import Picker from "@emoji-mart/react";
import { VscSend } from "react-icons/vsc";
import { motion, AnimatePresence } from "framer-motion";
import AiAssistant from "./AiAssistant";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const streamRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { sendMessage, selectedUser, setTypingStatus, groupChats } =
    useChatStore();
  const { authUser, blockedUsers } = useAuthStore();

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [audioUrl]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji.native);
    handleTyping();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: mimeType });
        if (audioBlob.size > 0) {
          setAudioBlob(audioBlob);
          setAudioUrl(URL.createObjectURL(audioBlob));
          await sendVoiceMessage(audioBlob);
        }
        audioChunks.current = [];
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      toast.success("Recording started...", { icon: "🎙️", duration: 2000 });
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Microphone access denied or unsupported format.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (blob) => {
    if (blockedUsers.includes(selectedUser?._id)) {
      toast.error("Cannot send message to a blocked user");
      return;
    }
    setIsSending(true);
    const formData = new FormData();
    const isGroupChat = groupChats.some(
      (group) => group._id === selectedUser._id
    );
    const audioFile = new File([blob], "voice.webm", { type: "audio/webm" });
    formData.append(isGroupChat ? "file" : "audio", audioFile);

    try {
      await sendMessage(formData, "audio");
      setAudioBlob(null);
      setAudioUrl(null);
      toast.success("Voice message sent!");
    } catch (error) {
      console.error("Failed to send voice message:", error);
      toast.error(`Failed to send voice message: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const sendImageMessage = async (imageDataUrl) => {
    if (blockedUsers.includes(selectedUser?._id)) {
      toast.error("Cannot send message to a blocked user");
      return;
    }
    setIsSending(true);
    const formData = new FormData();
    const response = await fetch(imageDataUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();
    const isGroupChat = groupChats.some(
      (group) => group._id === selectedUser._id
    );
    const file = new File([blob], "image.jpg", { type: "image/jpeg" });
    formData.append(isGroupChat ? "file" : "image", file);

    try {
      await sendMessage(formData, "image");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Image sent!");
    } catch (error) {
      console.error("Failed to send image message:", error);
      toast.error(`Failed to send image message: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = useCallback(() => {
    if (!selectedUser || blockedUsers.includes(selectedUser?._id)) return;
    setTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingStatus(false), 2000);
  }, [selectedUser, blockedUsers, setTypingStatus]);

  const handleSendTextOrImage = async (e) => {
    e.preventDefault();
    if (blockedUsers.includes(selectedUser?._id)) {
      toast.error("Cannot send message to a blocked user");
      return;
    }
    if (!text.trim() && !imagePreview && !audioBlob) {
      toast.error("Please enter a message, record audio, or attach an image");
      return;
    }

    setIsSending(true);
    try {
      if (text.trim()) await sendMessage({ text: text.trim() }, "text");
      if (imagePreview) await sendImageMessage(imagePreview);
      if (audioBlob) await sendVoiceMessage(audioBlob);
      setText("");
      setImagePreview(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setTypingStatus(false);
      toast.success("Message sent!", { duration: 1500 });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(`Failed to send message: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const buttonVariants = {
    hover: { scale: 1.15, rotate: 5 },
    tap: { scale: 0.9 },
  };

  return (
    <div className="p-3 w-full border-t border-gray-200 flex items-center gap-3 relative bg-white/90 backdrop-blur-md shadow-lg rounded-t-2xl">
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            className="absolute bottom-20 left-0 z-50"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{
              duration: 0.4,
              ease: "easeOut",
              type: "spring",
              stiffness: 100,
            }}
          >
            <Picker onEmojiSelect={handleEmojiSelect} />
            <motion.button
              onClick={() => setShowEmojiPicker(false)}
              className="mt-3 p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-all shadow-md"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              Close
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {imagePreview && (
          <motion.div
            className="absolute bottom-20 left-16 z-40"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-xl border border-gray-200 shadow-lg"
              />
              <motion.button
                onClick={removeImage}
                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 shadow-md"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={14} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AiAssistant isSending={isSending} />

      <motion.button
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        disabled={isSending}
        className={`p-2 rounded-full bg-gray-100 text-gray-600 shadow-md transition-all duration-300 ${
          isSending ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
        }`}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
      >
        <Smile size={18} />
      </motion.button>

      <motion.label
        className="p-2 rounded-full bg-gray-100 text-gray-600 shadow-md transition-all duration-300 cursor-pointer hover:bg-gray-200"
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
      >
        <Image size={18} />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageChange}
          disabled={isSending}
        />
      </motion.label>

      <motion.input
        type="text"
        className="w-full flex-1 px-4 py-2 border-2 border-gray-200 rounded-full text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-md bg-white/80 transition-all duration-300"
        placeholder={selectedUser ? "Message..." : "Select a conversation..."}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          handleTyping();
        }}
        disabled={
          isRecording ||
          isSending ||
          blockedUsers.includes(selectedUser?._id) ||
          !selectedUser
        }
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      {!isRecording ? (
        <motion.button
          type="button"
          onClick={startRecording}
          disabled={
            isSending ||
            blockedUsers.includes(selectedUser?._id) ||
            !selectedUser
          }
          className={`p-2 rounded-full bg-gray-100 text-gray-600 shadow-md transition-all duration-300 ${
            isSending ||
            blockedUsers.includes(selectedUser?._id) ||
            !selectedUser
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-gray-200"
          }`}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Mic size={20} />
        </motion.button>
      ) : (
        <motion.button
          type="button"
          onClick={stopRecording}
          className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md transition-all duration-300"
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          animate={{
            scale: [1, 1.1, 1],
            transition: { repeat: Infinity, duration: 1.5 },
          }}
        >
          <Mic size={18} />
        </motion.button>
      )}

      <motion.button
        onClick={handleSendTextOrImage}
        disabled={
          isSending ||
          blockedUsers.includes(selectedUser?._id) ||
          !selectedUser ||
          (!text.trim() && !imagePreview && !audioBlob)
        }
        className={`p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full hover:from-blue-600 hover:to-purple-700 shadow-lg transition-all duration-300 ${
          isSending ||
          blockedUsers.includes(selectedUser?._id) ||
          !selectedUser ||
          (!text.trim() && !imagePreview && !audioBlob)
            ? "opacity-50 cursor-not-allowed"
            : ""
        }`}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
      >
        <VscSend size={19} />
      </motion.button>
    </div>
  );
};

export default MessageInput;
