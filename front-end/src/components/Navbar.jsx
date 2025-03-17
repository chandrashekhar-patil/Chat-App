// src/components/Navbar.jsx
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageSquare, Settings, User } from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();

  return (
    <header className="navbar fixed top-0 z-40 w-full bg-base-100/95 backdrop-blur-md shadow-sm border-b border-base-300">
      <div className="container mx-auto px-4">
        <div className="navbar-start">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-200"
          >
            <div className="btn btn-ghost btn-circle bg-primary/10">
              <MessageSquare className="w-4 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-base-content">TextSpin</h1>{" "}
            {/* Updated to Elyxio */}
          </Link>
        </div>

        <div className="navbar-end flex items-center gap-2">
          <Link
            to="/settings"
            className="btn btn-ghost btn-sm flex items-center gap-2 hover:bg-base-200 transition-colors duration-200"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">
              Settings
            </span>
          </Link>

          {authUser && (
            <>
              <Link
                to="/profile"
                className="btn btn-ghost btn-sm flex items-center gap-2 hover:bg-base-200 transition-colors duration-200"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  Profile
                </span>
              </Link>

              <button
                onClick={logout}
                className="btn btn-ghost btn-sm flex items-center gap-2 text-error hover:bg-error/10 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  Logout
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
