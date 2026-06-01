import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store"; // 🔌 Імпортуємо твій глобальний стор

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Friends() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Використовуємо реактивний стан мови з твого спільного провайдера
  const { language } = useApp();
  const isUk = language === "uk";

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setNotConnected(true);
          return;
        }
        
        // Використовуємо динамічний префікс API_URL
        const response = await fetch(`${API_URL}/api/v1/analytics/overview`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.status === 401) {
          setNotConnected(true);
          return;
        }
        
        const data = await response.json();
        setFriends(data.friends || []);
      } catch (err) {
        console.error("Збій завантаження списку друзів:", err);
        setNotConnected(true);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--accent)", fontSize: "1.1rem" }}>{isUk ? "Завантаження списку друзів..." : "Loading friends list..."}</div>
    </div>
  );

  if (notConnected) return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: "16px" }}>👥</div>
      <h2 style={{ color: "var(--text-bright)", marginBottom: "8px" }}>
        {isUk ? "Steam не підключено" : "Steam not connected"}
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
        {isUk ? "Підключіть Steam акаунт щоб бачити список друзів" : "Connect your Steam account to see your friends list"}
      </p>
      <button className="btn btn-primary" onClick={() => navigate("/settings")}>
        {isUk ? "Підключити Steam" : "Connect Steam"}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", marginBottom: "24px", fontSize: "1.5rem" }}>
        👥 {isUk ? "Мережа друзів" : "Friends"} {friends.length > 0 && `(${friends.length})`}
      </h1>

      {friends.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>👥</div>
          <div style={{ color: "var(--text-secondary)" }}>
            {isUk ? "Список друзів закритий налаштуваннями приватності або порожній" : "Friends list is private or empty"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {friends.map(f => {
            // Безпечно витягуємо ID друга, страхуючись від різних форматів Valve API
            const currentFriendId = f.steam_id || f.steamid;

            return (
              <div 
                key={currentFriendId} 
                className="card"
                style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center", cursor: "pointer", transition: "border-color 0.15s" }}
                onClick={() => navigate(`/profile/${currentFriendId}`)}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                {f.avatar && (
                  <img src={f.avatar} style={{ width: "48px", height: "48px", borderRadius: "6px", flexShrink: 0 }} alt="" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text-bright)", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.personaname}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px" }}>
                    {f.gameextrainfo ? (
                      <span style={{ color: "var(--accent-green)", fontWeight: "600" }}>🎮 {f.gameextrainfo}</span>
                    ) : f.friend_since ? (
                      `${isUk ? "Друзі з" : "Friends since"} ${new Date(f.friend_since * 1000).getFullYear()}`
                    ) : (
                      "Steam Friend"
                    )}
                  </div>
                </div>
                <span style={{ color: "var(--accent)", fontSize: "0.8rem", flexShrink: 0 }}>→</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}