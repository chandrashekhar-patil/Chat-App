import { useRef, useState, useEffect, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Mic, Smile } from "lucide-react";
import toast from "react-hot-toast";
import Picker from "@emoji-mart/react";
import { VscSend } from "react-icons/vsc";

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
  const typingTimeoutRef = useRef(null); // Ref for debouncing typing
  const { sendMessage, selectedUser, setTypingStatus } = useChatStore();
  const { blockedUsers } = useAuthStore();

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); // Cleanup timeout
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
    handleTyping(); // Trigger typing when emoji is added
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
      toast.success("Recording started...");
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
    const audioFile = new File([blob], "voice.webm", { type: "audio/webm" });
    formData.append("audio", audioFile);

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

  // Handle typing with debounce
  const handleTyping = useCallback(() => {
    if (!selectedUser || blockedUsers.includes(selectedUser?._id)) return;

    setTypingStatus(true); // Start typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false); // Stop typing after 2 seconds of inactivity
    }, 2000);
  }, [selectedUser, blockedUsers, setTypingStatus]);

  const handleSendTextOrImage = async (e) => {
    e.preventDefault(); // Prevent page refresh
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
      if (text.trim()) {
        await sendMessage({ text: text.trim() }, "text");
      }

      if (imagePreview) {
        const formData = new FormData();
        const response = await fetch(imagePreview);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], "image.jpg", { type: "audio/webm" }); // Workaround
        formData.append("audio", file);
        await sendMessage(formData, "audio");
      }

      if (audioBlob) {
        const formData = new FormData();
        const audioFile = new File([audioBlob], "voice.webm", {
          type: "audio/webm",
        });
        formData.append("audio", audioFile);
        await sendMessage(formData, "audio");
      }

      setText("");
      setImagePreview(null);
      setAudioBlob(null);
      setAudioUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTypingStatus(false); // Stop typing after sending
      toast.success("Message sent!");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(`Failed to send message: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-2 w-full border-t border-gray-200 flex items-center gap-2 relative">
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-0 z-50">
          <Picker onEmojiSelect={handleEmojiSelect} />
          <button
            onClick={() => setShowEmojiPicker(false)}
            className="mt-2 p-1 bg-gray-200 rounded"
          >
            Close
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="absolute bottom-16 left-16 z-40">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        disabled={isSending}
        className={`p-1.5 rounded-full hover:bg-gray-100 transition ${
          isSending ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <Smile size={20} className="text-gray-600" />
      </button>

      <label className="p-1.5 rounded-full hover:bg-gray-100 transition">
        <Image size={20} className="text-gray-600" />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageChange}
          disabled={isSending}
        />
      </label>

      <input
        type="text"
        className="w-full flex-1 px-3 py-1.5 border-2 border-sky-500 rounded-full text-sm text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        placeholder="Type a message"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          handleTyping(); // Trigger typing on text change
        }}
        disabled={
          isRecording || isSending || blockedUsers.includes(selectedUser?._id)
        }
      />

      {!isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={isSending || blockedUsers.includes(selectedUser?._id)}
          className={`p-1.5 rounded-full hover:bg-gray-100 transition ${
            isSending || blockedUsers.includes(selectedUser?._id)
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
        >
          <Mic size={20} className="text-gray-600" />
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
        >
          <Mic size={20} />
        </button>
      )}

      <button
        onClick={handleSendTextOrImage}
        disabled={isSending || blockedUsers.includes(selectedUser?._id)}
        className={`p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition ${
          isSending || blockedUsers.includes(selectedUser?._id)
            ? "opacity-50 cursor-not-allowed"
            : ""
        }`}
      >
        <VscSend size={20} />
      </button>
    </div>
  );
};

export default MessageInput;
