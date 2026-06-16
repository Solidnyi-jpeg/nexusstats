import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import { Label } from "recharts";

// Виділяємо окремий компонент для посилання, щоб чисто працювати з hover-станом
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
        // Динамічно визначаємо колір за допомогою isActive від NavLink та нашого isHovered
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
  const { theme, toggleTheme, language, changeLanguage } = useApp();

  const links = [
    { to: "/", label: t("nav.dashboard"), icon: "📊" },
    { to: "/achievements", label: t("nav.achievements"), icon: "🏆" },
    { to: "/friends", label: t("nav.friends"), icon: "👥" },
    { to: "/esports", label: t("esport"), icon: "A" }, 
    { to: "/search", label: t("nav.search"), icon: "🔍" },
    { to: "/settings", label: t("nav.settings"), icon: "⚙️" },
    
  ];                              
   
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
      </div>
    </nav>
  );
}