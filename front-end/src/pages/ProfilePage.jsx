import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, Edit2, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const {
    authUser,
    isUpdatingProfile,
    isLoading,
    updateProfile,
    deleteAccount,
    checkAuth,
  } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  // Sync local state with authUser when it changes
  useEffect(() => {
    if (!authUser) {
      checkAuth(); // Fetch auth status if not loaded
    } else {
      setNewFullName(authUser.fullName || "");
      setNewEmail(authUser.email || "");
    }
  }, [authUser, checkAuth]);

  // Handle profile picture upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      try {
        await updateProfile({ profilePic: base64Image });
        toast.success("Profile picture updated!");
      } catch (error) {
        toast.error("Failed to update profile picture");
      }
    };
  };

  // Handle full name update
  const handleSaveName = async () => {
    if (newFullName.trim() === authUser.fullName || !newFullName.trim()) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateProfile({ fullName: newFullName });
      setIsEditingName(false);
      toast.success("Full name updated!");
    } catch (error) {
      toast.error("Failed to update full name");
    }
  };

  // Handle email update
  const handleSaveEmail = async () => {
    if (newEmail.trim() === authUser.email || !newEmail.trim()) {
      setIsEditingEmail(false);
      return;
    }
    try {
      await updateProfile({ email: newEmail });
      setIsEditingEmail(false);
      toast.success("Email updated!");
    } catch (error) {
      toast.error("Failed to update email");
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      try {
        await deleteAccount(); // Calls the store's deleteAccount function
        // No need for additional redirection/toast here; handled in store
      } catch (error) {
        // Error handling is already in deleteAccount via toast
      }
    }
  };

  if (!authUser)
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="h-screen pt-20 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">Profile</h1>
            <p className="mt-2 text-gray-500">
              Manage your profile information
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-32 rounded-full object-cover border-4 border-white shadow-md"
              />
              <label
                htmlFor="avatar-upload"
                className={`absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 p-2 rounded-full cursor-pointer transition-all duration-200 ${
                  isUpdatingProfile ? "animate-pulse pointer-events-none" : ""
                }`}
              >
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">
              {isUpdatingProfile
                ? "Uploading..."
                : "Click the camera to update your photo"}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-700 w-full"
                    disabled={isUpdatingProfile}
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-2 text-blue-500 hover:text-blue-600"
                    disabled={isUpdatingProfile}
                  >
                    <Save className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200">
                  <p className="text-gray-700">{authUser.fullName}</p>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              {isEditingEmail ? (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-700 w-full"
                    disabled={isUpdatingProfile}
                  />
                  <button
                    onClick={handleSaveEmail}
                    className="p-2 text-blue-500 hover:text-blue-600"
                    disabled={isUpdatingProfile}
                  >
                    <Save className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 rounded-lg border border-gray-200">
                  <p className="text-gray-700">{authUser.email}</p>
                  <button
                    onClick={() => setIsEditingEmail(true)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Account Information
            </h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <span>Member Since</span>
                <span>{authUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="text-green-500 font-medium">Active</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleDeleteAccount}
              className={`flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 ${
                isLoading || isUpdatingProfile
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={isLoading || isUpdatingProfile}
            >
              <Trash2 className="w-5 h-5" />
              {isLoading ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
