import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppProvider, useApp } from "./store"; // 🔌 Підключаємо твій глобальний стейт-менеджер

import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Achievements from "./pages/Achievements";
import Friends from "./pages/Friends";
import Search from "./pages/Search";
import Settings from "./pages/Settings";
import GameDetail from "./pages/GameDetail";
import FriendProfile from "./pages/FriendProfile";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/welcome" replace />;
  return children;
};

function Sidebar({ isOpen, toggleSidebar, hasPlatforms }) {
  const location = useLocation();
  const { t } = useTranslation();
  const username = localStorage.getItem("username") || "User";

  // 🔌 Використовуємо живі методи з твого глобального провайдера
  const { theme, toggleTheme, language, changeLanguage } = useApp();
  const isUk = language === "uk";

  if (location.pathname === "/welcome" || !hasPlatforms) return null;

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/welcome";
  };

  // Реактивне перемикання мови через твій store
  const handleToggleLanguage = () => {
    const nextLang = language === "uk" ? "en" : "uk";
    changeLanguage(nextLang);
  };

  const currentLangDisplay = (language || "uk").toUpperCase();

  const menuLinks = [
    { to: "/dashboard", label: isUk ? "📊 Дашборд" : "📊 Dashboard" },
    { to: "/achievements", label: isUk ? "🏆 Досягнення" : "🏆 Achievements" },
    { to: "/friends", label: isUk ? "👥 Друзі" : "👥 Friends" },
    { to: "/search", label: isUk ? "🔍 Пошук" : "🔍 Search" },
  ];

  return (
    <>
      <div style={{ ...styles.sidebar, left: isOpen ? "0" : "-280px" }}>
        <button onClick={toggleSidebar} style={styles.closeBtn}>✕</button>

        <div style={styles.logoContainer}>
          <span style={styles.logoIcon}>🎮</span>
          <h2 style={styles.logoText}>NexusStats</h2>
        </div>

        <div style={styles.accountSection}>
          <div style={styles.avatar}>👤</div>
          <div style={styles.accountName}>{username}</div>
        </div>

        {/* Динамічна навігація */}
        <nav style={styles.nav}>
          {menuLinks.map(link => (
            <Link 
              key={link.to}
              to={link.to} 
              onClick={toggleSidebar}
              style={{...styles.navLink, ...(location.pathname === link.to ? styles.activeNavLink : {})}}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.footerTitle}>{isUk ? "⚙️ Налаштування" : "⚙️ Settings"}</div>
          
          <button onClick={handleToggleLanguage} style={styles.footerActionBtn}>
            🌐 {isUk ? "Мова" : "Lang"}: {currentLangDisplay}
          </button>
          
          <button onClick={toggleTheme} style={styles.footerActionBtn}>
            {theme === "dark" ? "☀️ Світла тема" : "🌙 Темна тема"}
          </button>
          
          <Link to="/settings" onClick={toggleSidebar} style={styles.footerLink}>
            🛠️ {isUk ? "Усі налаштування" : "All Settings"}
          </Link>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            🚪 {isUk ? "Вийти з акаунту" : "Sign Out"}
          </button>
        </div>
      </div>

      {isOpen && <div onClick={toggleSidebar} style={styles.overlay} />}
    </>
  );
}

function AppContent() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasPlatforms, setHasPlatforms] = useState(false); 
  
  const isWelcome = location.pathname === "/welcome";

  const checkPlatformStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token || isWelcome) return;
    
    try {
      const response = await fetch('http://localhost:8000/api/v1/analytics/overview', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.total_games > 0) {
          setHasPlatforms(true);
          return;
        }
      }
    } catch (err) {
      console.error("Помилка синхронізації меню:", err);
    }
    setHasPlatforms(false);
  };

  useEffect(() => {
    checkPlatformStatus();
  }, [location.pathname, location.search]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)", position: "relative" }}>
      
      {!isWelcome && hasPlatforms && (
        <button onClick={toggleSidebar} style={styles.hamburgerBtn} title="Відкрити меню">
          ☰
        </button>
      )}

      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} hasPlatforms={hasPlatforms} />
      
      <div style={{ flex: 1, padding: isWelcome ? "0" : "2rem", overflowY: "auto", color: "var(--text-primary)" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard onSyncSuccess={checkPlatformStatus} /></ProtectedRoute>} />
          <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* Універсальний роут під твою нову структуру деталізації гри */}
          <Route path="/games/:platform/:gameId" element={<ProtectedRoute><GameDetail /></ProtectedRoute>} />
          <Route path="/profile/:steamId" element={<ProtectedRoute><FriendProfile /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}

const styles = {
  hamburgerBtn: { position: "fixed", top: "1.5rem", left: "1.5rem", fontSize: "2rem", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--accent)", cursor: "pointer", zIndex: 90, padding: "4px 12px", borderRadius: "8px" },
  sidebar: { position: "fixed", top: 0, bottom: 0, width: "280px", backgroundColor: "var(--bg-card)", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", padding: "2rem 1.2rem", color: "var(--text-primary)", zIndex: 200, transition: "left 0.25s ease-in-out" },
  closeBtn: { position: "absolute", top: "1.5rem", right: "1.2rem", backgroundColor: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer" },
  logoContainer: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" },
  logoIcon: { fontSize: "1.8rem" },
  logoText: { fontSize: "1.4rem", fontWeight: "800", color: "var(--accent)", margin: 0 },
  accountSection: { display: "flex", alignItems: "center", gap: "12px", padding: "0.8rem 0.5rem", backgroundColor: "var(--bg-main)", borderRadius: "10px", marginBottom: "2rem", border: "1px solid var(--border)" },
  avatar: { fontSize: "1.4rem", backgroundColor: "var(--bg-hover)", borderRadius: "50%", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" },
  accountName: { color: "var(--text-bright)", fontSize: "0.95rem", fontWeight: "600" },
  nav: { display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 },
  navLink: { display: "block", padding: "0.85rem 1rem", color: "var(--text-secondary)", textDecoration: "none", borderRadius: "8px", fontWeight: "600", fontSize: "1rem", transition: "all 0.2s" },
  activeNavLink: { backgroundColor: "var(--bg-hover)", color: "var(--accent)", border: "1px solid var(--border)" },
  sidebarFooter: { borderTop: "1px solid var(--border)", paddingTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem" },
  footerTitle: { fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.1rem", letterSpacing: "0.05em" },
  footerActionBtn: { width: "100%", padding: "0.65rem", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--bg-main)", color: "var(--text-primary)", textAlign: "left", cursor: "pointer", fontSize: "0.9rem", fontWeight: "500" },
  footerLink: { display: "block", padding: "0.5rem 0.65rem", color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem", fontWeight: "600" },
  logoutBtn: { width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--accent-red)", backgroundColor: "transparent", color: "var(--accent-red)", fontWeight: "600", cursor: "pointer", marginTop: "0.4rem" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 199 }
};