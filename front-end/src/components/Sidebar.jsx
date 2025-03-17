import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, ChevronRight, ChevronLeft, X } from "lucide-react";
import { motion } from "framer-motion";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    getUsers();
  }, []);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <>
      {/* Mobile Menu Button */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-3 left-7 z-60 w-10 h-10 bg-black text-white rounded-full shadow-lg focus:outline-none lg:hidden"
        >
          <div className="flex items-center justify-center w-full h-full">
            <ChevronRight className="size-6 text-white" />
          </div>
        </button>
      )}

      {/* Background Overlay (Mobile) */}
      {isSidebarOpen && (
        <div
          onClick={() => {
            console.log("Overlay clicked, closing sidebar");
            setIsSidebarOpen(false);
          }}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-black/70 border-r border-gray-600 flex flex-col shadow-xl transition-transform duration-300 z-50 lg:relative lg:w-72 
          ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-6 text-white" />
            <span className="font-semibold text-xl text-white">Contacts</span>
          </div>
          <button
            onClick={() => {
              console.log("Close button clicked");
              setIsSidebarOpen(false);
            }}
            className="lg:hidden text-white"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Toggle Online Users */}
        <div className="mt-4 flex items-center justify-between px-5">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="toggle toggle-primary toggle-sm"
            />
            <span className="text-sm font-medium text-white">Online Only</span>
          </label>
          <span className="text-sm text-white bg-gray-700 px-2 py-1 rounded-full">
            {onlineUsers.length - 1} Online
          </span>
        </div>

        {/* User List */}
        <div className="overflow-y-auto w-full py-4 flex-1">
          {filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => {
                console.log("User clicked:", user);
                setSelectedUser(user);
                setIsSidebarOpen(false);
              }}
              className={`w-full p-3 flex items-center gap-4 hover:bg-blue-600/20 focus:outline-none transition-all duration-200
              ${
                selectedUser?._id === user._id
                  ? "bg-blue-600/30 border-l-4 border-blue-500"
                  : "border-l-4 border-transparent"
              }`}
            >
              <div className="relative w-12 h-12">
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.fullName}
                  className="w-12 h-12 object-cover rounded-full border-2 border-gray-500"
                />
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                )}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="font-medium truncate text-white text-lg">
                  {user.fullName}
                </span>
                <span
                  className={`text-sm ${
                    onlineUsers.includes(user._id)
                      ? "text-green-400"
                      : "text-gray-400"
                  }`}
                >
                  {onlineUsers.includes(user._id)}
                </span>
              </div>
            </button>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Users className="mx-auto size-8 mb-2 opacity-50" />
              <p>No {showOnlineOnly ? "online" : ""} users found</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
