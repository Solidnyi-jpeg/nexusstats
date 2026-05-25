import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "../store";

export default function Navbar() {
  const { t } = useTranslation();
  const { theme, toggleTheme, language, changeLanguage } = useApp();
  const location = useLocation();

  const links = [
    { to: "/", label: t("nav.dashboard"), icon: "📊" },
    { to: "/achievements", label: t("nav.achievements"), icon: "🏆" },
    { to: "/friends", label: t("nav.friends"), icon: "👥" },
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
      <Link to="/" style={{
        display: "flex", alignItems: "center", gap: "10px",
        textDecoration: "none",
      }}>
        <span style={{ fontSize: "1.5rem" }}>🎮</span>
        <span style={{
          color: "var(--accent)", fontWeight: "bold",
          fontSize: "1.1rem", letterSpacing: "0.1em",
        }}>NEXUSSTATS</span>
      </Link>

      <div style={{ display: "flex", gap: "4px" }}>
        {links.map(link => (
          <Link key={link.to} to={link.to} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "6px",
            textDecoration: "none",
            color: location.pathname === link.to ? "var(--accent)" : "var(--text-secondary)",
            background: location.pathname === link.to ? "var(--bg-hover)" : "transparent",
            fontSize: "0.9rem", fontWeight: "500",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            if (location.pathname !== link.to)
              e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={e => {
            if (location.pathname !== link.to)
              e.currentTarget.style.color = "var(--text-secondary)";
          }}
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button onClick={() => changeLanguage(language === "uk" ? "en" : "uk")}
          className="btn btn-outline" style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
          {language === "uk" ? "EN" : "УК"}
        </button>
        <button onClick={toggleTheme}
          className="btn btn-outline" style={{ padding: "4px 10px" }}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  );
}
