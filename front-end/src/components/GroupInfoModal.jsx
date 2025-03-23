import { X, Edit2, Save, Plus, Trash2, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

const GroupInfoModal = ({ group, onClose }) => {
  if (!group || !group.isGroupChat) return null;

  const { updateGroupChat, deleteGroupChat, groupChats, setSelectedUser } =
    useChatStore();
  const { authUser } = useAuthStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(group.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [groupDescription, setGroupDescription] = useState(
    group.description || "No description"
  );
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersWithNames, setMembersWithNames] = useState(group.members);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMembers(true);
      try {
        if (!group.members[0].fullName) {
          const memberIds = group.members.map((m) => m._id || m);
          const memberResponse = await axiosInstance.get("/users/multiple", {
            params: { ids: memberIds.join(",") },
          });
          setMembersWithNames(memberResponse.data);
        }
        const usersResponse = await axiosInstance.get("/messages/users");
        setAvailableUsers(
          usersResponse.data.filter(
            (user) =>
              !membersWithNames.some((m) => m._id === user._id) &&
              user._id !== authUser._id
          )
        );
      } catch (error) {
        toast.error("Failed to load group info");
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchData();
  }, [group.members, authUser._id]);

  const creatorName =
    membersWithNames.find((m) => m._id === (group.creator._id || group.creator))
      ?.fullName || "Unknown";
  const createdAt = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString()
    : "Unknown";

  const handleSaveName = async () => {
    if (newGroupName.trim() === group.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateGroupChat(group._id, { name: newGroupName });
      setIsEditingName(false);
      toast.success("Group name updated!");
    } catch (error) {
      toast.error("Failed to update group name");
    }
  };

  const handleSaveDescription = async () => {
    if (groupDescription.trim() === (group.description || "")) {
      setIsEditingDescription(false);
      return;
    }
    try {
      await updateGroupChat(group._id, { description: groupDescription });
      setIsEditingDescription(false);
      toast.success("Group description updated!");
    } catch (error) {
      toast.error("Failed to update description");
    }
  };

  const handleAddMembers = async (newMemberIds) => {
    try {
      const updatedMembers = [
        ...group.members.map((m) => m._id || m),
        ...newMemberIds,
      ];
      await updateGroupChat(group._id, { members: updatedMembers });
      setMembersWithNames([
        ...membersWithNames,
        ...availableUsers.filter((u) => newMemberIds.includes(u._id)),
      ]);
      setAvailableUsers(
        availableUsers.filter((u) => !newMemberIds.includes(u._id))
      );
      toast.success("Members added!");
      setIsAddingMembers(false);
    } catch (error) {
      toast.error("Failed to add members");
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
  
    console.log("Attempting to leave group:", { groupId: group._id, userId: authUser._id });
    try {
      const res = await axiosInstance.delete(`/group-chats/${group._id}/leave`);
      console.log("Leave group response:", res.data);
      
      // After successfully leaving, close the modal and update UI
      toast.success("Left group successfully");
      
      // No need to call updateGroupChat as you're no longer in the group
      // Instead, update the local state directly
      useChatStore.setState(state => ({
        groupChats: state.groupChats.filter(g => g._id !== group._id),
        selectedUser: null
      }));
      
      onClose();
    } catch (error) {
      console.error("Error leaving group:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(error.response?.data?.message || "Failed to leave group");
    }
  };

  const handleDeleteGroup = async () => {
    if (window.confirm("Are you sure you want to delete this group?")) {
      try {
        await deleteGroupChat(group._id);
        onClose();
        toast.success("Group deleted!");
      } catch (error) {
        toast.error("Failed to delete group");
      }
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Group Info</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">{group.name[0].toUpperCase()}</span>
          </div>
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="p-2 border rounded-lg w-full"
              />
              <button onClick={handleSaveName} className="text-blue-500">
                <Save size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-medium">{group.name}</h3>
              {group.creator._id === authUser._id && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-600"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-gray-500">
            {membersWithNames.length} members
          </p>
          <p className="text-sm text-gray-600 italic">
            Created by {creatorName} on {createdAt}
          </p>

          <div className="mt-4 w-full">
            {isEditingDescription ? (
              <div className="flex items-center gap-2">
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="p-2 border rounded-lg w-full"
                  rows={3}
                />
                <button
                  onClick={handleSaveDescription}
                  className="text-blue-500"
                >
                  <Save size={16} />
                </button>
              </div>
            ) : (
              <div className="flex justify-between">
                <p className="text-sm text-gray-600">{groupDescription}</p>
                {group.creator._id === authUser._id && (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="text-gray-600"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 w-full">
            <h4 className="text-md font-semibold">Members:</h4>
            {isLoadingMembers ? (
              <p>Loading members...</p>
            ) : (
              <ul className="mt-2 max-h-40 overflow-y-auto">
                {membersWithNames.map((member) => (
                  <li
                    key={member._id || `member-${Math.random()}`}
                    className="flex items-center justify-between py-1"
                  >
                    <span>{member.fullName || "Unknown"}</span>
                  </li>
                ))}
              </ul>
            )}
            {group.creator._id === authUser._id && (
              <button
                onClick={() => setIsAddingMembers(true)}
                className="mt-2 text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={14} /> Add Members
              </button>
            )}
          </div>

          {isAddingMembers && (
            <div className="mt-4 w-full">
              <h4 className="text-md font-semibold">Add Members:</h4>
              <ul className="mt-2 max-h-40 overflow-y-auto">
                {availableUsers.map((user) => (
                  <li key={user._id || `user-${Math.random()}`} className="flex items-center py-1">
                    <input
                      type="checkbox"
                      onChange={(e) =>
                        e.target.checked && handleAddMembers([user._id])
                      }
                      className="mr-2"
                    />
                    <span>{user.fullName}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setIsAddingMembers(false)}
                className="mt-2 text-gray-600"
              >
                Close
              </button>
            </div>
          )}

          <div className="mt-6 w-full flex justify-between">
            {group.creator._id === authUser._id ? (
              <button
                onClick={handleDeleteGroup}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <Trash2 size={16} /> Delete Group
              </button>
            ) : (
              <button
                onClick={handleLeaveGroup}
                className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <LogOut size={16} /> Leave Group
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GroupInfoModal;