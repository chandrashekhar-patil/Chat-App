// src/pages/SettingsPage.jsx
import { useThemeStore } from "../store/useThemeStore";
import { Sun, Moon, Palette } from "lucide-react";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "coffee", label: "Coffee", icon: Palette },
  { value: "forest", label: "Forest", icon: Palette },
  { value: "autumn", label: "Autumn", icon: Palette },
];

const SettingsPage = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center p-4 bg-base-200">
      <div className="card w-full max-w-lg shadow-xl bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-3xl font-bold justify-center text-base-content">
            Settings
          </h2>
          <p className="text-center text-base-content/70 mb-6">
            Customize your TextSpin experience
          </p>

          {/* Theme Selection */}
          <div className="form-control space-y-2">
            <label className="label">
              <span className="label-text font-medium flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Appearance
              </span>
            </label>
            <div className="relative">
              <select
                className="select select-bordered w-full bg-base-200 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                {THEMES.map((t) => (
                  <option
                    key={t.value}
                    value={t.value}
                    className="flex items-center"
                  >
                    <t.icon className="inline-block w-4 h-4 mr-2" />
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Theme Preview */}
          <div className="mt-6">
            <label className="label">
              <span className="label-text font-medium">Theme Preview</span>
            </label>
            <div className="p-4 rounded-lg bg-base-100 border border-base-300 text-base-content">
              <p className="text-sm">
                This is a preview of the{" "}
                <span className="font-semibold capitalize">{theme}</span> theme.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="card-actions justify-center mt-6">
            <button
              className="btn btn-primary w-full hover:btn-primary/90"
              onClick={() => toast.success("Settings applied!")} // Assuming toast is imported
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
