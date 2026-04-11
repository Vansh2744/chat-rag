import { type ChangeEvent, useEffect, useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { motion } from "framer-motion";
import axios from "axios";
import { backendUrl } from "../../utils/backendUrl";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "../context/userContext";
import { Spinner } from "../../components/ui/spinner";

export default function AuthPage() {
  const [mode, setMode] = useState("signin");
  const [details, setDetails] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const { user, fetchCurrentUser } = useCurrentUser();

  useEffect(() => {
    if (user?.id) {
      navigate("/");
    }
  }, [user]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    try {
      setDetails((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    } catch (error) {
      console.log(error);
    }
  };

  const handleAuth = async (e: ChangeEvent<HTMLFormElement>) => {
    setLoading(true);
    e.preventDefault();
    try {
      if (mode == "signup") {
        if (details.password !== details.confirmPassword) {
          console.log("Password and Confirm Password should be same");
        } else {
          await axios.post(`${backendUrl}/users/sign-up`, {
            name: details.name,
            email: details.email,
            password: details.password,
          });
          setMode("signin");
        }
      } else {
        const res = await axios.post(`${backendUrl}/users/sign-in`, {
          email: details.email,
          password: details.password,
        });

        localStorage.setItem("accessToken", res.data.access_token);
        localStorage.setItem("refreshToken", res.data.refresh_token);

        fetchCurrentUser();
        navigate("/");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 p-4 w-full">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-center text-white mb-2">
              {mode === "signin" ? "Welcome Back 👋" : "Create Your Account 🚀"}
            </h1>

            <p className="text-center text-sm text-gray-400 mb-6">
              {mode === "signin"
                ? "Sign in to continue making AI-powered notes"
                : "Sign up to start creating smart AI notes"}
            </p>

            <form className="space-y-4" onSubmit={handleAuth}>
              {mode === "signup" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-gray-300">Name</Label>
                  <Input
                    className="bg-white/10 border-white/10 text-white focus:ring-2 focus:ring-indigo-500"
                    name="name"
                    placeholder="Your full name"
                    value={details.name}
                    onChange={handleChange}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label className="text-gray-300">Email</Label>
                <Input
                  className="bg-white/10 border-white/10 text-white focus:ring-2 focus:ring-indigo-500"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={details.email}
                  onChange={handleChange}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-gray-300">Password</Label>
                <Input
                  className="bg-white/10 border-white/10 text-white focus:ring-2 focus:ring-indigo-500"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={details.password}
                  onChange={handleChange}
                />
              </div>

              {mode === "signup" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-gray-300">Confirm Password</Label>
                  <Input
                    className="bg-white/10 border-white/10 text-white focus:ring-2 focus:ring-indigo-500"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={details.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              )}

              <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-300">
                {loading ? (
                  <Spinner />
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Sign Up"
                )}
              </Button>
            </form>

            <div className="text-center text-sm mt-6 text-gray-400">
              {mode === "signin" ? (
                <p>
                  Don’t have an account?{" "}
                  <button
                    className="text-indigo-400 font-medium hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    className="text-indigo-400 font-medium hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
