import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPublicProfile } from "../api";
import GameRow from "../components/GameRow";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function FriendProfile() {
  const { steamId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isUk = i18n.language === "uk";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    getPublicProfile(steamId)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [steamId]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      // Завантажуємо дані напряму зі Steam без зміни головного акаунту
      const res = await axios.get(`${API_URL}/profile/${steamId}/preview`);
      setData(res.data);
      setSyncMsg(isUk ? "✅ Дані завантажено!" : "✅ Data loaded!");
    } catch {
      setSyncMsg(isUk ? "❌ Помилка завантаження" : "❌ Failed to load");
    } finally {
      setSyncing(false);
    }
  };

  const handleBookmark = async () => {
    if (!data) return;
    try {
      await axios.post(`${API_URL}/profile/bookmarks`, null, {
        params: {
          platform: "steam",
          platform_user_id: steamId,
          display_name: data.personaname,
          avatar_url: data.avatar,
        }
      });
      setBookmarked(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "2rem" }}>👤</div>
      <div style={{ color: "var(--accent)" }}>{isUk ? "Завантаження профілю..." : "Loading profile..."}</div>
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: "center", padding: "60px" }}>
      <div style={{ color: "var(--accent-red)" }}>{isUk ? "Профіль не знайдено" : "Profile not found"}</div>
    </div>
  );

  const statusColors = ["var(--border)", "var(--accent-green)", "#66c0f4", "#f8c63a", "#ab47bc", "#ef5350", "#4caf50"];
  const statusLabels = isUk
    ? ["Офлайн", "Онлайн", "Зайнятий", "Відійшов", "Відійшов", "Не турбувати", "Грає"]
    : ["Offline", "Online", "Busy", "Away", "Away", "Snooze", "Playing"];

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
      <button onClick={() => navigate(-1)} style={{
        background: "none", border: "none", color: "var(--text-secondary)",
        cursor: "pointer", marginBottom: "20px", fontSize: "0.9rem",
      }}>← {isUk ? "Назад" : "Back"}</button>

      {/* Profile Header */}
      <div className="card" style={{ padding: "32px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {data.avatar && (
              <img src={data.avatar} style={{ width: "100px", height: "100px", borderRadius: "10px", display: "block" }} />
            )}
            <div style={{
              position: "absolute", bottom: "4px", right: "4px",
              width: "14px", height: "14px", borderRadius: "50%",
              background: statusColors[data.personastate || 0] || "var(--border)",
              border: "2px solid var(--bg-card)",
            }} title={statusLabels[data.personastate || 0]} />
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <h1 style={{ color: "var(--text-bright)", fontSize: "1.8rem", marginBottom: "4px" }}>
              {data.personaname}
            </h1>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "12px" }}>
              Steam ID: {data.steam_id}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <a href={data.profileurl} target="_blank" rel="noreferrer"
                className="btn btn-outline" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
                Steam ↗
              </a>
              <button className={`btn ${bookmarked ? "btn-primary" : "btn-outline"}`}
                onClick={handleBookmark} disabled={bookmarked}
                style={{ fontSize: "0.85rem" }}>
                {bookmarked ? "🔖 " + (isUk ? "Збережено" : "Saved") : "🔖 " + (isUk ? "Закладка" : "Bookmark")}
              </button>
              {!data.is_synced && (
                <button className="btn btn-outline" onClick={handleSync} disabled={syncing}
                  style={{ fontSize: "0.85rem", borderColor: "var(--accent-green)", color: "var(--accent-green)" }}>
                  {syncing ? "⏳" : "🔄"} {isUk ? "Завантажити ігри" : "Load Games"}
                </button>
              )}
            </div>
            {syncMsg && (
              <div style={{ marginTop: "10px", color: "var(--accent-green)", fontSize: "0.85rem" }}>{syncMsg}</div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {[
              { label: isUk ? "Ігор" : "Games", value: data.total_games || "🔒", icon: "🎮" },
              { label: isUk ? "Годин" : "Hours", value: data.total_hours > 0 ? `${data.total_hours}h` : "🔒", icon: "⏱️" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
                <div style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "1.3rem" }}>{s.value}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Games — always show */}
      {data.top_games?.length > 0 && (
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ color: "var(--text-bright)", marginBottom: "16px", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🏆 {isUk ? "Топ ігор" : "Top Games"}
          </h3>
          {data.top_games.map((g, i) => (
            <GameRow key={g.game_id || i} game={g} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Not synced notice */}
      {!data.is_synced && (
        <div className="card" style={{ padding: "20px", marginTop: "16px", borderColor: "var(--accent)44" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "1.5rem" }}>ℹ️</div>
            <div>
              <div style={{ color: "var(--text-bright)", marginBottom: "4px" }}>
                {isUk ? "Детальна аналітика недоступна" : "Detailed analytics unavailable"}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {isUk
                  ? "Натисніть Синхронізувати щоб імпортувати повну статистику цього гравця"
                  : "Click Sync to NexusStats to import full stats for this player"
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
