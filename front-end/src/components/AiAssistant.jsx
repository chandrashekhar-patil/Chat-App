import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Send,
  Moon,
  Sun,
  Mic,
  Volume2,
  Trash2,
  MessageSquare
} from "lucide-react";
import { AiOutlineSend } from "react-icons/ai";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const AiAssistant = ({ isSending }) => {
  const [showAiModal, setShowAiModal] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isAiSending, setIsAiSending] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [modalHeight, setModalHeight] = useState(50);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const aiResponseRef = useRef(null);
  const modalRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const clickSoundRef = useRef(
    new Audio("https://www.soundjay.com/buttons/beep-01a.mp3")
  );

  const { selectedUser, sendMessage } = useChatStore();
  const { blockedUsers } = useAuthStore();

  // Handle Enter key for AI message submission
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAiSubmit(e);
    }
  };

  // Handle Enter key for sending to chat
  const handleSendToChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendToChat(e);
    }
  };

  // Dark mode detection
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );
    setIsDarkMode(darkModeMediaQuery.matches);
    const handleChange = (e) => setIsDarkMode(e.matches);
    darkModeMediaQuery.addEventListener("change", handleChange);
    return () => darkModeMediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [aiInput]);

  // Auto-scroll to bottom
  useEffect(() => {
    const ref = aiResponseRef.current;
    if (ref) {
      ref.scrollTo({ top: ref.scrollHeight, behavior: "smooth" });
    }
  }, [chatHistory]);

  // Ensure textarea reflects cleared input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = aiInput;
    }
  }, [aiInput]);

  // Speech recognition with proper cleanup
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setAiInput(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      toast.error("Voice recognition failed");
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Dragging handlers
  const handleMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("textarea")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const maxX = window.innerWidth - (modalRef.current?.offsetWidth || 300);
      const maxY = window.innerHeight - (modalRef.current?.offsetHeight || 400);
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp, { once: true });
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Resize handler
  const handleResize = useCallback((e) => {
    const newHeight =
      ((window.innerHeight - e.clientY) / window.innerHeight) * 100;
    if (newHeight >= 30 && newHeight <= 80) setModalHeight(newHeight);
  }, []);

  const startResize = (e) => {
    e.preventDefault();
    window.addEventListener("mousemove", handleResize);
    window.addEventListener(
      "mouseup",
      () => window.removeEventListener("mousemove", handleResize),
      { once: true }
    );
  };

  const handleClearChat = () => {
    setChatHistory([]);
    toast.success("Chat cleared!");
    clickSoundRef.current.play().catch((err) => console.error("Audio error:", err));
  };

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    try {
      clickSoundRef.current.play();
    } catch (err) {
      console.error("Audio error:", err);
    }

    setIsAiLoading(true);
    const newMessage = {
      role: "user",
      content: aiInput,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, newMessage]);
    setAiInput("");

    try {
      const res = await axiosInstance.post("/ai/chat", { message: aiInput });
      const reply = res.data.reply || "Sorry, I couldn't process your request.";
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: reply, timestamp: new Date() },
      ]);
    } catch (error) {
      console.error("AI request failed:", error);
      toast.error("AI request failed");
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Failed to get response. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendToChat = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      toast.error("Please select a user first");
      return;
    }
    if (blockedUsers.includes(selectedUser?._id)) {
      toast.error("Cannot send to blocked user");
      return;
    }
    setIsAiSending(true);
    try {
      await sendMessage(
        {
          text: chatHistory[chatHistory.length - 1].content,
        },
        "text"
      );
      toast.success("Sent to chat!");
    } catch (error) {
      console.error("Failed to send:", error);
      toast.error("Failed to send to chat");
    } finally {
      setIsAiSending(false);
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowAiModal(true)}
        disabled={isSending}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
          isSending
            ? "bg-gray-400 cursor-not-allowed"
            : isDarkMode
            ? "bg-teal-600 hover:bg-teal-700 text-white"
            : "bg-teal-500 hover:bg-teal-600 text-white"
        } shadow-md`}
        variants={modalVariants}
      >
        <MessageSquare size={20} className="text-white" />
        <span>AI</span>
      </motion.button>

      <AnimatePresence>
        {showAiModal && !isMinimized && (
          <motion.div
            ref={modalRef}
            className="fixed bottom-20 left-0 right-0 mx-auto w-full max-w-lg z-50 shadow-2xl rounded-2xl"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              height: `${modalHeight}vh`,
            }}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseDown={handleMouseDown}
            role="dialog"
            aria-label="AI Assistant Modal"
          >
            <div
              className={`rounded-2xl overflow-hidden flex flex-col h-full border-2 ${
                isDarkMode
                  ? "bg-gray-800 text-gray-100 border-gray-700"
                  : "bg-white text-gray-900 border-teal-200"
              } shadow-lg`}
            >
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-between cursor-move">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 4,
                      ease: "linear",
                    }}
                  >
                    <MessageSquare size={24} className="text-white" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-white">
                    AI Assistant
                  </h2>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={handleClearChat}
                    variants={modalVariants}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors duration-300"
                    aria-label="Clear Chat"
                  >
                    <Trash2 size={18} className="text-white" />
                  </motion.button>
                  <motion.button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    variants={modalVariants}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-teal-600 hover:bg-teal-700 transition-colors duration-300"
                    aria-label="Toggle Dark Mode"
                  >
                    {isDarkMode ? (
                      <Sun size={18} className="text-white" />
                    ) : (
                      <Moon size={18} className="text-white" />
                    )}
                  </motion.button>
                  <motion.button
                    onClick={() => setShowAiModal(false)}
                    variants={modalVariants}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full bg-red-500 hover:bg-red-600 transition-colors duration-300"
                    aria-label="Close AI Chat"
                  >
                    <X size={18} className="text-white" />
                  </motion.button>
                </div>
              </div>
              {/* Resize Handle */}
              <div
                className="p-1 bg-gradient-to-r from-teal-100 to-cyan-100 cursor-ns-resize hover:bg-teal-200 transition-colors duration-300"
                onMouseDown={startResize}
              >
                <div className="h-1 bg-teal-400 rounded-full mx-auto w-24" />
              </div>
              {/* Chat Area */}
              <div
                className={`flex-1 p-5 overflow-y-auto ${
                  isDarkMode ? "bg-gray-800" : "bg-gray-50"
                }`}
                ref={aiResponseRef}
              >
                {chatHistory.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-gray-500 mt-4"
                  >
                    Start a conversation...
                  </motion.div>
                )}
                <AnimatePresence>
                  {chatHistory.map((msg, index) => (
                    <motion.div
                      key={index}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      } mb-4`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={
                        msg.role === "ai"
                          ? () => {
                              if (!window.speechSynthesis) {
                                toast.error("Text-to-speech not supported");
                                return;
                              }
                              if (isPlaying) {
                                window.speechSynthesis.cancel();
                                setIsPlaying(false);
                                return;
                              }
                              const utterance = new SpeechSynthesisUtterance(
                                msg.content
                              );
                              utterance.rate = 1.1;
                              utterance.pitch = 1.2;
                              const voices = window.speechSynthesis.getVoices();
                              const uniqueVoice =
                                voices.find((voice) =>
                                  /female|samantha|zira/i.test(voice.name)
                                ) || voices[0];
                              utterance.voice = uniqueVoice;
                              utterance.onstart = () => setIsPlaying(true);
                              utterance.onend = () => setIsPlaying(false);
                              utterance.onerror = () => {
                                setIsPlaying(false);
                                toast.error("Speech playback failed");
                              };
                              window.speechSynthesis.speak(utterance);
                            }
                          : undefined
                      }
                      style={msg.role === "ai" ? { cursor: "pointer" } : {}}
                    >
                      <motion.div
                        className={`max-w-[80%] p-4 rounded-xl shadow-sm ${
                          msg.role === "user"
                            ? "bg-teal-600 text-white"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-100"
                            : "bg-gray-200 text-gray-900"
                        } transition-all duration-200`}
                      >
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || "");
                              return !inline && match ? (
                                <div className="relative my-2">
                                  <div className="text-xs text-gray-300 bg-gray-800 px-3 py-1 rounded-t-lg">
                                    {match[1].toUpperCase() === "A"
                                      ? "JAVA"
                                      : match[1].toUpperCase()}
                                  </div>
                                  <SyntaxHighlighter
                                    style={dracula}
                                    language={match[1] === "a" ? "Code" : match[1]}
                                    PreTag="div"
                                    customStyle={{
                                      borderRadius: "0 0 8px 8px",
                                      padding: "12px",
                                      background: "#1e1e2f",
                                      fontSize: "0.9rem",
                                    }}
                                    wrapLines={true}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, "")}
                                  </SyntaxHighlighter>
                                  <motion.button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(String(children));
                                      toast.success("Copied to clipboard!", {
                                        icon: "📋",
                                      });
                                    }}
                                    className="absolute top-2 right-2 p-1 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors duration-200"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <Copy size={14} className="text-gray-200" />
                                  </motion.button>
                                </div>
                              ) : (
                                <code className={`${className} bg-gray-300 px-1 rounded text-sm`}>
                                  {children}
                                </code>
                              );
                            },
                            p: ({ children }) => <p className="mb-1">{children}</p>,
                            h1: ({ children }) => <h1 className="text-2xl font-bold my-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-bold my-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-bold my-1">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc pl-5 my-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 my-1">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                  {isAiLoading && (
                    <motion.div
                      className="flex justify-start mb-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="load flex items-center gap-2">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1 }}
                        >
                        </motion.div>
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((index) => (
                            <motion.span
                              key={index}
                              animate={{ y: [0, -5, 0] }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.5,
                                ease: "easeInOut",
                                delay: index * 0.15,
                              }}
                              className="w-2 h-2 bg-teal-500 rounded-full"
                            ></motion.span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* Input Form */}
              <form
                onSubmit={handleAiSubmit}
                className={`p-4 border-t ${
                  isDarkMode ? "border-gray-700" : "border-teal-100"
                } ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
              >
                <div className="relative flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    className={`w-full p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      isDarkMode
                        ? "bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400"
                        : "bg-white text-gray-900 border-teal-200 placeholder-gray-400"
                    } transition-all duration-300 shadow-sm`}
                    placeholder="Type your message..."
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    rows={1}
                    maxLength={2000}
                    disabled={isAiLoading}
                    aria-label="AI Input"
                  />
                  <div className="flex gap-2 mb-1">
                    <motion.button
                      onClick={() => {
                        if (!recognitionRef.current) {
                          toast.error("Speech recognition not supported");
                          return;
                        }
                        if (isListening) {
                          recognitionRef.current.stop();
                          setIsListening(false);
                          toast.success("Stopped listening");
                        } else {
                          recognitionRef.current.start();
                          setIsListening(true);
                          toast.success("Listening...");
                        }
                      }}
                      disabled={isAiLoading || !recognitionRef.current}
                      className={`p-2 rounded-lg ${
                        isListening ? "bg-teal-500" : "bg-teal-600"
                      } text-white hover:bg-teal-700 transition-colors duration-300 shadow-sm`}
                      variants={modalVariants}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={isListening ? "Stop Listening" : "Start Listening"}
                    >
                      <Mic size={18} />
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isAiLoading || !aiInput.trim()}
                      className="p-2 rounded-lg bg-teal-600 text-white disabled:opacity-50 hover:bg-teal-700 transition-colors duration-300 shadow-sm"
                      variants={modalVariants}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label="Send Message"
                    >
                      <AiOutlineSend size={18} />
                    </motion.button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-right text-gray-400">
                  {isListening ? (
                    <span className="text-teal-400 animate-pulse">Listening...</span>
                  ) : (
                    "Enter to send"
                  )}
                </div>
              </form>
              {/* Action Buttons */}
              {chatHistory.length > 0 &&
                chatHistory[chatHistory.length - 1].role === "ai" && (
                  <motion.div
                    className={`p-4 flex gap-3 border-t ${
                      isDarkMode ? "border-gray-700" : "border-teal-100"
                    } ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
                  >
                    <motion.button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          chatHistory[chatHistory.length - 1].content
                        );
                        toast.success("Copied to clipboard!");
                      }}
                      className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-2 ${
                        isDarkMode
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-100"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                      } transition-colors duration-300 shadow-sm`}
                      variants={modalVariants}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label="Copy Response"
                    >
                      <Copy size={16} /> Copy
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        if (!window.speechSynthesis) {
                          toast.error("Text-to-speech not supported");
                          return;
                        }
                        if (isPlaying) {
                          window.speechSynthesis.cancel();
                          setIsPlaying(false);
                          return;
                        }
                        const utterance = new SpeechSynthesisUtterance(
                          chatHistory[chatHistory.length - 1].content
                        );
                        utterance.rate = 1.1;
                        utterance.pitch = 1.2;
                        const voices = window.speechSynthesis.getVoices();
                        const uniqueVoice =
                          voices.find((voice) =>
                            /female|samantha|zira/i.test(voice.name)
                          ) || voices[0];
                        utterance.voice = uniqueVoice;
                        utterance.onstart = () => setIsPlaying(true);
                        utterance.onend = () => setIsPlaying(false);
                        utterance.onerror = () => {
                          setIsPlaying(false);
                          toast.error("Speech playback failed");
                        };
                        window.speechSynthesis.speak(utterance);
                      }}
                      className={`p-2 rounded-lg flex items-center justify-center gap-2 ${
                        isPlaying
                          ? "bg-teal-600 hover:bg-teal-700 text-white"
                          : isDarkMode
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-100"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                      } transition-colors duration-300 shadow-sm`}
                      variants={modalVariants}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={isPlaying ? "Stop Speaking" : "Speak Response"}
                    >
                      <Volume2 size={16} /> {isPlaying ? "Stop" : "Speak"}
                    </motion.button>
                    <motion.button
                      onClick={handleSendToChat}
                      onKeyPress={handleSendToChatKeyPress}
                      disabled={!selectedUser || isAiSending}
                      className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-2 ${
                        !selectedUser || isAiSending
                          ? "bg-emerald-400 opacity-50 text-white"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white"
                      } transition-colors duration-300 shadow-sm`}
                      variants={modalVariants}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label="Send to Chat"
                    >
                      <Send size={16} /> Send
                    </motion.button>
                  </motion.div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={clickSoundRef} className="hidden" />
    </div>
  );
};

export default AiAssistant; 
