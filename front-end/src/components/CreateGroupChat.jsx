// components/CreateGroupChat.js
import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Users, X } from "lucide-react";
import { motion } from "framer-motion";

const CreateGroupChat = ({ onClose }) => {
  const { users, createGroupChat } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Added loading state

  // Toggle member selection
  const handleMemberSelection = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Reset form fields
  const resetForm = () => {
    setGroupName("");
    setGroupDescription("");
    setSelectedMembers([]);
  };

  // Handle group creation
  const handleCreateGroup = async () => {
    if (!groupName || selectedMembers.length === 0) {
      alert("Please provide a group name and select at least one member.");
      return;
    }
  
    const groupData = {
      name: groupName,
      description: groupDescription,
      members: selectedMembers, // Array of selected member IDs
    };
  
    setIsLoading(true); // Start loading
    try {
      await createGroupChat(groupData); // Call store method
      onClose(); // Close modal
      resetForm(); // Reset form after success
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Failed to create group. Please try again.");
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="size-6 text-blue-400" />
            <h2 className="text-2xl font-semibold text-white">
              Create New Group
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Group Name
            </label>
            <input
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              placeholder="Add a group description"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none h-24"
              disabled={isLoading}
            />
          </div>

          {/* Member Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add Members ({selectedMembers.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto bg-gray-800 rounded-lg border border-gray-700 p-2">
              {users.map((user) => (
                <div
                  key={user._id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedMembers.includes(user._id)
                      ? "bg-blue-600/20"
                      : "hover:bg-gray-700"
                  } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                  onClick={() => !isLoading && handleMemberSelection(user._id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user._id)}
                    readOnly
                    className="h-5 w-5 text-blue-500 rounded border-gray-600 focus:ring-blue-500 cursor-pointer"
                    disabled={isLoading}
                  />
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium truncate">
                      {user.fullName}
                    </span>
                  </div>
                  {onlineUsers.includes(user._id) && (
                    <span className="w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-gray-400 text-center py-4">
                  No users available
                </p>
              )}
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateGroup}
            aria-label="Create Group"
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            disabled={isLoading || !groupName || selectedMembers.length === 0}
          >
            {isLoading ? "Creating..." : "Create Group"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateGroupChat;
