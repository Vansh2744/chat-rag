import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <Navbar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;