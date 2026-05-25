import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./store";
import "./i18n";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Achievements from "./pages/Achievements";
import Search from "./pages/Search";
import Settings from "./pages/Settings";
import Friends from "./pages/Friends";
import Welcome from "./pages/Welcome";
import GameDetail from "./pages/GameDetail";
import FriendProfile from "./pages/FriendProfile";
import axios from "axios";

function AppContent() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Перевіряємо чи є вже дані в БД
    axios.get("http://localhost:8000/debug/stats")
      .then(res => {
        const hasData = res.data.games > 0;
        const setupDone = localStorage.getItem("nexusstats_setup_done");
        setShowWelcome(!hasData && !setupDone);
      })
      .catch(() => setShowWelcome(false))
      .finally(() => setChecking(false));
  }, []);

  const handleWelcomeComplete = () => {
    localStorage.setItem("nexusstats_setup_done", "true");
    setShowWelcome(false);
  };

  if (checking) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", flexDirection: "column", gap: "16px",
    }}>
      <div style={{ fontSize: "3rem" }}>🎮</div>
      <div style={{ color: "var(--accent)", fontSize: "1.1rem" }}>Loading NexusStats...</div>
    </div>
  );

  if (showWelcome) return <Welcome onComplete={handleWelcomeComplete} />;

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/games/:platform/:gameId" element={<GameDetail />} />
        <Route path="/profile/:steamId" element={<FriendProfile />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
