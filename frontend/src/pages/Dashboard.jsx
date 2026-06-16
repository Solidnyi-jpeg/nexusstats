import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";
import { getOverview, forceSyncCurrentUser } from "../api";

// Окремий підкомпонент для картки гри 
function GameCard({ g, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const pct = g.achievement_total > 0
    ? Math.round((g.achievement_count / g.achievement_total) * 100) 
    : 0;

  return (
    <div 
      role="button"
      tabIndex={0}
      className="card" 
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        padding: "14px 16px", 
        cursor: "pointer", 
        transition: "border-color .15s ease, transform .15s ease",
        borderColor: isHovered ? "var(--accent)" : "var(--border)",
        transform: isHovered ? "translateY(-2px)" : "none"
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {g.img_icon_url && !imgError ? (
          <img 
            src={g.img_icon_url} 
            alt="" 
            style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }} 
            onError={() => setImgError(true)} 
          />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--bg-hover)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
            🎮
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: ".9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {g.name}
          </div>
          <div style={{ color: "var(--accent-gold)", fontSize: ".8rem", marginTop: 2 }}>
            {g.playtime_hours}h
          </div>
          {g.achievement_total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--accent-gold)" : "var(--accent)", borderRadius: 2 }} />
              </div>
              <span style={{ color: "var(--text-secondary)", fontSize: ".68rem", whiteSpace: "nowrap" }}>
                {g.achievement_count}/{g.achievement_total}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Головний компонент 
export default function Dashboard({ onSyncSuccess }) {
  const navigate = useNavigate();
  const { language } = useApp();
  const uk = language === "uk"; 

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const fetchData = () => {
    setLoading(true);
    getOverview()
      .then(res => {
        setData(res.data);
        if (onSyncSuccess && res.data.total_games > 0) {
          onSyncSuccess();
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { 
    fetchData(); 
  }, []);
  
  const handleForceSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await forceSyncCurrentUser();
      if (res.data.status === "started") {
        setTimeout(() => {
          window.location.reload(); 
        }, 8000); 
      } else {
        setSyncMsg(res.data.message || "");
        setSyncing(false); 
      }
    } catch {
      setSyncMsg(uk ? "❌ Помилка з'єднання" : "❌ Connection error");
      setSyncing(false); 
    }
  };

  if (loading || syncing) return (
    <div className="loading-screen">
      <div className="cube-wrapper">
        <div className="cube-3d">
          <div className="cube-face front"></div>
          <div className="cube-face back"></div>
          <div className="cube-face right"></div>
          <div className="cube-face left"></div>
          <div className="cube-face top"></div>
          <div className="cube-face bottom"></div>
        </div>
      </div>
      <div className="loading-text" style={{ textAlign: "center", lineHeight: "1.5", whiteSpace: "pre-line" }}>
        {syncing 
          ? (uk ? "Синхронізуємо дані зі Steam... ⏱️\nЗачекайте, сторінка оновиться автоматично." : "Syncing with Steam... ⏱️\nPlease wait, the page will reload automatically.") 
          : (uk ? "Завантаження даних..." : "Loading data...")}
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--accent-red)" }}>
      {uk ? "Не вдалося завантажити дані" : "Failed to load data"}
    </div>
  );

  const statCards = [
    { icon: "🎮", label: uk ? "Ігор всього" : "Total Games", value: data.total_games, color: "var(--accent)" },
    { icon: "⏱️", label: uk ? "Годин всього" : "Total Hours", value: `${data.total_hours}h`, color: "var(--accent-gold)" },
    { icon: "🕐", label: uk ? "За 2 тижні" : "Last 2 Weeks", value: `${data.recent_hours}h`, color: "var(--accent-green)" },
    { icon: "🏆", label: uk ? "Досягнень" : "Achievements", value: data.total_achievements, color: "var(--accent-purple)" },
    { icon: "📊", label: uk ? "Виконання" : "Completion", value: `${data.achievement_completion}%`, color: "var(--accent)" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      {/* Header + sync button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ color: "var(--text-bright)", fontSize: "1.5rem" }}>
          {uk ? "Огляд" : "Dashboard"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {syncMsg && <span style={{ color: "var(--accent-red)", fontSize: ".82rem" }}>{syncMsg}</span>}
          <button
            className="btn btn-outline"
            onClick={handleForceSync}
            disabled={syncing}
            style={{ fontSize: ".85rem", borderColor: "var(--accent-green)", color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 6 }}
          >
            {syncing ? "⏳" : "🔄"} {uk ? "Оновити всі дані" : "Refresh All Data"}
          </button>
        </div>
      </div>

      {/* Верхня статистика */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem" }} aria-hidden="true">{s.icon}</div>
            <div style={{ color: s.color, fontSize: "1.35rem", fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: ".73rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/*  RECENT + TOP  */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginBottom: "32px" }}>
        
        {/* Recent */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <h2 style={{ color: "var(--text-bright)", fontSize: "1rem", marginBottom: 12 }}>
            <span aria-hidden="true">🕐</span> {uk ? "Нещодавно зіграні" : "Recently Played"}
          </h2>
          {(data.recent_games || []).length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)", height: "100%" }}>
              {uk ? "Немає активності за останні 2 тижні" : "No activity in last 2 weeks"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(data.recent_games || []).map(g => (
                <GameCard key={g.platform_game_id} g={g} 
                onClick={() => {
                 if (g.platform_game_id === "570") {
                  navigate("/dota"); 
                 } else {
                 navigate(`/games/${g.platform}/${g.platform_game_id}`);
                 }
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Top */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <h2 style={{ color: "var(--text-bright)", fontSize: "1rem", marginBottom: 12 }}>
            <span aria-hidden="true">🏆</span> {uk ? "Найбільше зіграно" : "Most Played"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.top_games || []).slice(0, 8).map(g => (
              <GameCard key={g.platform_game_id} g={g} onClick={() => navigate(`/games/${g.platform}/${g.platform_game_id}`)} />
            ))}
          </div>
        </div>
      </div>

      {/* ----------------- PLATFORMS (резерв) ----------------- */}
      {/* {(data.platforms_breakdown || []).filter(p => p.games > 0).length > 0 && (
        <div style={{ width: "100%", display: "block" }}>
          <h2 style={{ color: "var(--text-bright)", fontSize: "1rem", marginBottom: 12 }}>
            <span aria-hidden="true">🌐</span> {uk ? "По платформах" : "By Platform"}
          </h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {data.platforms_breakdown
              .filter(p => p.games > 0)
              .map(p => (
              <div key={p.platform} className="card" style={{ padding: "16px 20px", minWidth: 200, flex: "1 1 auto" }}>
                <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: "1rem", marginBottom: 8, textTransform: "capitalize" }}>
                  {p.platform === "steam" ? "🎮 Steam" : p.platform}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", lineHeight: 1.8 }}>
                  <div>{uk ? "Ігор" : "Games"}: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{p.games}</span></div>
                  <div>{uk ? "Годин" : "Hours"}: <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>{p.hours}h</span></div>
                  <div>{uk ? "Досягнень" : "Achievements"}: <span style={{ color: "var(--accent-purple)", fontWeight: 600 }}>{p.achievements}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      */}
    </div>
  );
}