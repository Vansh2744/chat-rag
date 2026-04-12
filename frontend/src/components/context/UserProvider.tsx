import { useEffect, useState, type ReactNode } from "react";
import { UserContext } from "./userContext";
import axios from "axios";
import { backendUrl } from "../../utils/backendUrl";
import { type CurrentUser } from "../../types";
import { useNavigate } from "react-router-dom";

function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const fetchCurrentUser = async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${backendUrl}/users/current-user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUser(res.data);
    } catch (error) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const clearUser = () => {
    setUser(null);
  };

  const logout = async () => {
    const accessToken = localStorage.getItem("accessToken");
    try {
      await axios.post(
        `${backendUrl}/users/sign-out`,
        { email: user?.email },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      clearUser();
      navigate("/auth");
    }
  };

  return (
    <UserContext.Provider
      value={{ user, fetchCurrentUser, clearUser, logout, loading }}
    >
      {children}
    </UserContext.Provider>
  );
}

export default UserProvider;
