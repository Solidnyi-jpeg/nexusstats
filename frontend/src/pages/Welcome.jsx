import { useState, useEffect } from "react";
import { useApp } from "../store";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../api";

export default function Welcome() {
  const { language } = useApp();
  const uk = language === "uk";
  
  // Додаємо інструменти для читання URL
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loadingType, setLoadingType] = useState(null);

  // ПЕРЕХОПЛЕННЯ ТОКЕНА (Для Steam)
  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    
    if (token) {
      // Якщо в URL є токен, зберігаємо його і редіректимо в дашборд
      localStorage.setItem("token", token);
      localStorage.setItem("access_token", token);
      window.location.replace("/"); 
    } else if (error) {
      alert(uk ? "Помилка авторизації!" : "Auth error!");
      navigate("/welcome", { replace: true });
    }
  }, [searchParams, navigate, uk]);

  const handleSteamLogin = () => {
    setLoadingType("steam");
    window.location.href = `${API_URL}/api/v1/auth/steam/login`;
  };

  const handleWGLogin = () => {
    setLoadingType("wg");
    const appId = "7f718cf85a9ad6397aa4c32459518d41"; 
    const redirect = encodeURIComponent(`${window.location.origin}/wg-callback`);
    window.location.href = `https://api.worldoftanks.eu/wot/auth/login/?application_id=${appId}&redirect_uri=${redirect}`;
  };

  // --- ЕКРАН ЗАВАНТАЖЕННЯ З КУБИКОМ ---
  if (loadingType) {
    return (
      <div className="loading-screen" style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div className="cube-wrapper">
          <div className="cube-3d">
            <div className="cube-face front"></div><div className="cube-face back"></div><div className="cube-face right"></div><div className="cube-face left"></div><div className="cube-face top"></div><div className="cube-face bottom"></div>
          </div>
        </div>
        <div className="loading-text" style={{ textAlign: "center", marginTop: 24, fontSize: "1.1rem", color: "var(--text-bright)" }}>
          {loadingType === "steam" 
            ? (uk ? "З'єднання зі Steam... 🎮" : "Connecting to Steam... 🎮")
            : (uk ? "З'єднання з Wargaming... 🛡️" : "Connecting to Wargaming... 🛡️")
          }
        </div>
      </div>
    );
  }

  // --- СТАНДАРТНИЙ ЕКРАН ПРИВІТАННЯ ---
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-main)" }}>
      <div className="card" style={{ maxWidth: 450, width: "100%", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎮</div>
        <h1 style={{ color: "var(--text-bright)", fontSize: "2rem", marginBottom: 12, letterSpacing: "2px" }}>NEXUSSTATS</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem", marginBottom: 40, lineHeight: 1.5 }}>
          {uk ? "Універсальна аналітична платформа для відстеження вашої ігрової статистики." : "Universal analytics platform for tracking your gaming stats."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button className="btn btn-primary" onClick={handleSteamLogin} style={{ width: "100%", padding: "14px", background: "linear-gradient(90deg, #171a21 0%, #2a3f5a 100%)", borderColor: "#2a3f5a", fontSize: "1.05rem" }}>
            {uk ? "Увійти через Steam" : "Login with Steam"}
          </button>

          <div style={{ display: "flex", alignItems: "center", margin: "10px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
            <span style={{ padding: "0 10px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>{uk ? "АБО" : "OR"}</span>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
          </div>

          <button className="btn btn-outline" onClick={handleWGLogin} style={{ width: "100%", padding: "14px", borderColor: "#FF4D00", color: "#FF4D00", fontSize: "1.05rem" }}>
            {uk ? "Увійти через Wargaming" : "Login with Wargaming"}
          </button>
        </div>
      </div>
    </div>
  );
}