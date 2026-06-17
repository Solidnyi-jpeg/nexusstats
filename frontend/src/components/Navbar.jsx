import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom"; // Додано useNavigate
import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import api from "../api"; // Імпортуємо api для запиту на бекенд

function NavItem({ to, label, icon }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <NavLink
      to={to}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 14px",
        borderRadius: "6px",
        textDecoration: "none",
        color: isActive ? "var(--accent)" : isHovered ? "var(--text-primary)" : "var(--text-secondary)",
        background: isActive ? "var(--bg-hover)" : "transparent",
        fontSize: "0.9rem",
        fontWeight: "500",
        transition: "all 0.2s ease",
      })}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );    
}

export default function Navbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme, language, changeLanguage } = useApp();

  const links = [
    { to: "/", label: t("nav.dashboard"), icon: "📊" },
    { to: "/achievements", label: t("nav.achievements"), icon: "🏆" },
    { to: "/friends", label: t("nav.friends"), icon: "👥" },
    { to: "/esports", label: t("esport"), icon: "A" }, 
    { to: "/wot", label: "WoT Stats", icon: "🛡️" }, 
    { to: "/settings", label: t("nav.settings"), icon: "⚙️" },
  ];                              
   
  // ФІКС: Функція виходу з системи
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout"); // Повідомляємо бекенд
    } catch (err) {
      console.warn("Бекенд не відповів на logout", err);
    } finally {
      localStorage.removeItem("token"); // Видаляємо токен клієнта (зміни назву, якщо у тебе він називається access_token)
      navigate("/welcome", { replace: true }); // Перекидаємо на стартову сторінку
    }
  };

  return (
    <nav style={{
      background: "var(--bg-card)",
      borderBottom: "1px solid var(--border)",
      padding: "0 24px",
      height: "60px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <NavLink to="/" style={{
        display: "flex", alignItems: "center", gap: "10px",
        textDecoration: "none",
      }}>
        <span style={{ fontSize: "1.5rem" }}>🎮</span>
        <span style={{
          color: "var(--accent)", fontWeight: "bold",
          fontSize: "1.1rem", letterSpacing: "0.1em",
        }}>NEXUSSTATS</span>
      </NavLink>

      <div style={{ display: "flex", gap: "4px" }}>
        {links.map(link => (
          <NavItem key={link.to} {...link} />
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button 
          onClick={() => changeLanguage(language === "uk" ? "en" : "uk")}
          className="btn btn-outline" 
          style={{ padding: "4px 12px", fontSize: "0.8rem" }}
          aria-label="Toggle Language"
        >
          {language === "uk" ? "EN" : "UA"}
        </button>
        <button 
          onClick={toggleTheme}
          className="btn btn-outline" 
          style={{ padding: "4px 10px" }}
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        
        {/* Кнопка Виходу */}
        <button 
          onClick={handleLogout}
          className="btn btn-outline" 
          style={{ padding: "4px 10px", borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
          title={language === "uk" ? "Вийти" : "Logout"}
        >
          🚪
        </button>
      </div>
    </nav>
  );
}