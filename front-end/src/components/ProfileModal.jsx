import { X } from "lucide-react";
import { motion } from "framer-motion";

const ProfileModal = ({ user, onClose }) => {
  if (!user) return null;

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
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileModal;
