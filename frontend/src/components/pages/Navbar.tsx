import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, FileText, Youtube, Sparkles } from "lucide-react";
import { useCurrentUser } from "../context/userContext";

export default function Navbar() {
  const { user, logout } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  const navItem = (to: string, label: string, Icon: any) => {
    const active = location.pathname === to;

    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
          active
            ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black font-medium"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800"
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <span className="font-semibold text-zinc-100">DocuMind AI</span>
        </div>
        <div className="flex items-center gap-2">
          {navItem("/chat-pdf", "PDF Chat", FileText)}
          {navItem("/chat-youtube", "YouTube Chat", Youtube)}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white hidden sm:block bg-gray-800 px-5 py-2 rounded-md">
            {user?.email}
          </span>

          <button
            onClick={() => {
              logout();
              navigate("/auth");
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
