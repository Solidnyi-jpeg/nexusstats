import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getFriends } from "../api";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Friends() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isUk = i18n.language === "uk";
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [steamId, setSteamId] = useState(null);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    // Отримуємо Steam ID поточного користувача з БД
    axios.get(`${API_URL}/debug/stats`)
      .then(async () => {
        // Отримуємо підключений Steam акаунт
        const connRes = await axios.get(`${API_URL}/debug/connection`);
        if (connRes.data.steam_id) {
          setSteamId(connRes.data.steam_id);
          const friendsRes = await getFriends(connRes.data.steam_id);
          setFriends(friendsRes.data);
        } else {
          setNotConnected(true);
        }
      })
      .catch(() => setNotConnected(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--accent)" }}>{isUk ? "Завантаження..." : "Loading..."}</div>
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
        👥 {isUk ? "Друзі" : "Friends"} {friends.length > 0 && `(${friends.length})`}
      </h1>

      {friends.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>👥</div>
          <div style={{ color: "var(--text-secondary)" }}>
            {isUk ? "Список друзів закритий або порожній" : "Friends list is private or empty"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {friends.map(f => (
            <div key={f.steam_id} className="card"
              style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center", cursor: "pointer", transition: "border-color 0.15s" }}
              onClick={() => navigate(`/profile/${f.steam_id}`)}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              {f.avatar && (
                <img src={f.avatar} style={{ width: "48px", height: "48px", borderRadius: "6px", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "var(--text-bright)", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.personaname}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                  {f.friend_since ? `${isUk ? "Друзі з" : "Friends since"} ${new Date(f.friend_since * 1000).getFullYear()}` : "Steam Friend"}
                </div>
              </div>
              <span style={{ color: "var(--accent)", fontSize: "0.8rem", flexShrink: 0 }}>→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
