import { X } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/useAuthStore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const ProfileModal = ({ user, onClose }) => {
  const { onlineUsers, socket } = useAuthStore();
  const [userExists, setUserExists] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const handleUserDeleted = (data) => {
      console.log("User deleted event received:", data);
      if (data.userId === user?._id) {
        toast(`${user.fullName} has deleted their account.`, {
          style: { background: "#e0f7fa", color: "#0288d1" },
        });
        setUserExists(false);
        setTimeout(onClose, 100);
      }
    };

    socket.on("userDeleted", handleUserDeleted);
    return () => socket.off("userDeleted", handleUserDeleted);
  }, [socket, user, onClose]);

  if (!user || !userExists) {
    return (
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Profile Details
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
          <p className="text-gray-500 text-center">
            This user no longer exists.
          </p>
        </div>
      </motion.div>
    );
  }

  const isOnline = onlineUsers.includes(user._id);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={modalVariants}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Profile Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        <div className="flex flex-col items-center">
          <img
            src={user.profilePic || "/avatar.png"}
            alt={user.fullName}
            className="w-24 h-24 rounded-full border-2 border-gray-300 mb-4 object-cover"
          />
          <h3 className="text-lg font-medium text-gray-800">{user.fullName}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
          <p
            className={`text-sm ${
              isOnline ? "text-green-500" : "text-gray-500"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileModal;
