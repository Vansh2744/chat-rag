import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";
import { Route, Routes } from "react-router-dom";
import AuthPage from "./components/pages/AuthPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/pages/Layout";
import { ChatWithYouTube } from "./components/pages/ChatWithYouTube";
import { ChatWithPDF } from "./components/pages/ChatWithPDF";
import HomePage from "./components/pages/HomePage";

function App() {

  return (
    <>
      <Routes>
        <Route path="/auth/" element={<AuthPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/chat-youtube" element={<ChatWithYouTube />} />
          <Route path="/chat-pdf" element={<ChatWithPDF />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
