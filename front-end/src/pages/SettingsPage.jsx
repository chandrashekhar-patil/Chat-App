import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  Sun,
  Moon,
  Palette,
  Ban,
  Bell,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "coffee", label: "Coffee", icon: Palette },
  { value: "forest", label: "Forest", icon: Palette },
  { value: "autumn", label: "Autumn", icon: Palette },
];

const SettingsPage = () => {
  const { theme, setTheme } = useThemeStore();
  const { authUser, blockedUsers, logout } = useAuthStore();
  const [fontSize, setFontSize] = useState(
    authUser?.settings?.fontSize || "medium"
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    authUser?.settings?.notificationsEnabled ?? true
  );
  const [messagePreviews, setMessagePreviews] = useState(
    authUser?.settings?.messagePreviews ?? true
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser?.settings?.theme) {
      setTheme(authUser.settings.theme);
    }
  }, [authUser, setTheme]);

  useEffect(() => {
    document.documentElement.style.fontSize =
      fontSize === "small" ? "14px" : fontSize === "large" ? "18px" : "16px";
  }, [fontSize]);

  const handleDeleteAccount = async () => {
    try {
      await axiosInstance.delete("/delete-account");
      logout();
      toast.success("Account deleted successfully");
      navigate("/login");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(error.response?.data?.message || "Failed to delete account");
    }
  };

  const handleApplyChanges = async () => {
    try {
      const settings = {
        theme,
        fontSize,
        notificationsEnabled,
        messagePreviews,
      };
      const res = await axiosInstance.put("/update-profile", {
        settings,
      });
      useAuthStore.setState({ authUser: res.data });
      toast.success("Settings applied successfully!");
    } catch (error) {
      console.error("Error applying settings:", error);
      toast.error(error.response?.data?.message || "Failed to apply settings");
    }
  };

  return (
    <div className="min-h-screen flex bg-base-200">
      {/* Sidebar */}
      <div className="w-64 p-6 bg-base-100 border-r border-base-300">
        <h2 className="text-2xl font-bold text-base-content mb-6">Settings</h2>
        <ul className="space-y-4">
          <li className="text-base-content/70 hover:text-base-content transition-all">
            <a href="#theme" className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Theme
            </a>
          </li>
          <li className="text-base-content/70 hover:text-base-content transition-all">
            <a href="#style" className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Style Preferences
            </a>
          </li>
          <li className="text-base-content/70 hover:text-base-content transition-all">
            <a href="#chat" className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat Settings
            </a>
          </li>
          <li className="text-base-content/70 hover:text-base-content transition-all">
            <a href="#blocked" className="flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Blocked Users
            </a>
          </li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-base-content mb-6">
            Customize Your Experience
          </h1>

          {/* Theme Selection */}
          <div id="theme" className="mb-8">
            <h2 className="text-xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Theme
            </h2>
            <select
              className="select select-bordered w-full bg-base-100 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="mt-4 p-4 rounded-lg bg-base-100 border border-base-300 text-base-content">
              <p className="text-sm">
                This is a preview of the{" "}
                <span className="font-semibold capitalize">{theme}</span> theme.
              </p>
            </div>
          </div>

          {/* Style Preferences */}
          <div id="style" className="mb-8">
            <h2 className="text-xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Style Preferences
            </h2>
            <div className="p-4 rounded-lg bg-base-100 border border-base-300 text-base-content space-y-4">
              <div className="form-control">
                <label className="label cursor-pointer justify-between">
                  <span className="label-text">Font Size</span>
                  <select
                    className="select select-sm select-bordered w-32"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Chat Settings */}
          <div id="chat" className="mb-8">
            <h2 className="text-xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat Settings
            </h2>
            <div className="p-4 rounded-lg bg-base-100 border border-base-300 text-base-content space-y-4">
              <div className="form-control">
                <label className="label cursor-pointer justify-between">
                  <span className="label-text">Enable Notifications</span>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="toggle toggle-primary"
                  />
                </label>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer justify-between">
                  <span className="label-text">Show Message Previews</span>
                  <input
                    type="checkbox"
                    checked={messagePreviews}
                    onChange={(e) => setMessagePreviews(e.target.checked)}
                    className="toggle toggle-primary"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Blocked Users */}
          <div id="blocked" className="mb-8">
            <h2 className="text-xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Blocked Users
            </h2>
            <div className="p-4 rounded-lg bg-base-100 border border-base-300 text-base-content">
              <p className="text-sm">
                You have blocked{" "}
                <span className="font-semibold">{blockedUsers.length}</span>{" "}
                user
                {blockedUsers.length !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              className="btn btn-primary hover:btn-primary/90"
              onClick={handleApplyChanges}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">
              Confirm Account Deletion
            </h3>
            <p className="py-4">
              Are you sure you want to delete your account? This action cannot
              be undone, and all your data will be permanently removed.
            </p>
            <div className="modal-action">
              <button className="btn btn-error" onClick={handleDeleteAccount}>
                Delete
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
