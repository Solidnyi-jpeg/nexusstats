import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";
// Зверни увагу: додано connectPlaystation в імпорти
import { getOverview, forceSyncCurrentUser, connectPlaystation } from "../api";

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

  // Стейт для PlayStation
  const [psnInputOpen, setPsnInputOpen] = useState(false);
  const [psnId, setPsnId] = useState("");
  const [psnConnecting, setPsnConnecting] = useState(false);

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

  const handleConnectPsn = async () => {
    if (!psnId.trim()) return;
    setPsnConnecting(true);
    try {
      await connectPlaystation({ psn_id: psnId.trim() });
      window.location.reload(); 
    } catch (err) {
      setSyncMsg(uk ? "❌ Помилка підключення PSN" : "❌ Error connecting PSN");
    } finally {
      setPsnConnecting(false);
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
          ? (uk ? "Синхронізуємо дані... ⏱️\nЗачекайте, сторінка оновиться автоматично." : "Syncing data... ⏱️\nPlease wait, the page will reload automatically.") 
          : (uk ? "Завантаження даних..." : "Loading data...")}
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--accent-red)" }}>
      {uk ? "Не вдалося завантажити дані" : "Failed to load data"}
    </div>
  );

  const hasData = data.total_games > 0;

  // --- ЕКРАН ПІДКЛЮЧЕННЯ ПЛАТФОРМ (Якщо немає даних) ---
  if (!hasData) {
    return (
      <div style={{ maxWidth: 1000, margin: "60px auto", textAlign: "center", padding: "0 24px" }}>
        <h1 style={{ color: "var(--text-bright)", fontSize: "2.5rem", marginBottom: 16 }}>
          {uk ? "Вітаємо в NexusStats!" : "Welcome to NexusStats!"}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: 40, maxWidth: 600, margin: "0 auto 40px" }}>
          {uk 
            ? "Ваш профіль ще не містить аналітичних даних. Для початку роботи підключіть ігрову платформу або виконайте синхронізацію." 
            : "Your profile has no analytics data yet. Connect a gaming platform or run a sync to get started."}
        </p>

        {syncMsg && <div style={{ color: "var(--accent-red)", marginBottom: 20 }}>{syncMsg}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          
          {/* Steam Card */}
          <div className="card" style={{ padding: 32, border: "2px solid #171a21", background: "linear-gradient(180deg, rgba(23,26,33,0.3) 0%, transparent 100%)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎮</div>
            <h3 style={{ color: "var(--text-bright)", fontSize: "1.5rem", marginBottom: 12 }}>Steam</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 24, minHeight: 40 }}>
              {uk ? "Підключено. Натисніть кнопку нижче, щоб стягнути ігри." : "Connected. Click below to fetch games."}
            </p>
            <button 
              className="btn btn-primary" 
              onClick={handleForceSync} 
              style={{ width: "100%", padding: "12px", background: "#171a21", borderColor: "#2a3f5a" }}
            >
              {uk ? "🔄 Синхронізувати Steam" : "🔄 Sync Steam"}
            </button>
          </div>

          {/* Wargaming (World of Tanks) Card */}
          <div className="card" style={{ padding: 32, border: "2px solid rgba(255, 77, 0, 0.4)", position: "relative" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🛡️</div>
            <h3 style={{ color: "var(--text-bright)", fontSize: "1.5rem", marginBottom: 12 }}>World of Tanks</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 24, minHeight: 40 }}>
              {uk ? "Синхронізуйте вінрейт та бойову статистику з акаунту Wargaming." : "Sync winrate and battle stats from your Wargaming account."}
            </p>
            <button 
              className="btn btn-outline" 
              onClick={() => {
                  const appId = "7f718cf85a9ad6397aa4c32459518d41"; 
                  const redirect = encodeURIComponent(`${window.location.origin}/wg-callback`);
                  window.location.href = `https://api.worldoftanks.eu/wot/auth/login/?application_id=${appId}&redirect_uri=${redirect}`;
              }}
              style={{ width: "100%", padding: "12px", borderColor: "#FF4D00", color: "#FF4D00" }}
            >
              {uk ? "🔗 Підключити WoT" : "🔗 Connect WoT"}
            </button>
          </div>

          {/* PlayStation Card */}
          <div className="card" style={{ padding: 32, border: "2px solid rgba(0, 55, 145, 0.4)", position: "relative", overflow: "hidden" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔵</div>
            <h3 style={{ color: "var(--text-bright)", fontSize: "1.5rem", marginBottom: 12 }}>PlayStation</h3>
            
            {!psnInputOpen ? (
              <>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 24, minHeight: 40 }}>
                  {uk ? "Підключіть ваш PSN ID для синхронізації трофеїв." : "Connect your PSN ID to sync trophies."}
                </p>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setPsnInputOpen(true)}
                  style={{ width: "100%", padding: "12px", borderColor: "#003791", color: "#003791" }}
                >
                  {uk ? "🔗 Підключити PSN" : "🔗 Connect PSN"}
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", margin: 0 }}>
                  {uk ? "Введіть ваш публічний PSN ID:" : "Enter your public PSN ID:"}
                </p>
                <input 
                  type="text" 
                  value={psnId}
                  onChange={(e) => setPsnId(e.target.value)}
                  placeholder="e.g. Kratos_1999"
                  style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #003791", background: "rgba(0, 55, 145, 0.1)", color: "#fff", outline: "none" }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleConnectPsn}
                    disabled={psnConnecting}
                    style={{ flex: 1, background: "#003791", borderColor: "#003791" }}
                  >
                    {psnConnecting ? "⏳..." : uk ? "Зберегти" : "Save"}
                  </button>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => setPsnInputOpen(false)}
                    style={{ padding: "0 12px", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Xbox Card */}
          <div className="card" style={{ padding: 32, border: "2px solid rgba(16, 124, 16, 0.3)", opacity: 0.8 }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🟢</div>
            <h3 style={{ color: "var(--text-bright)", fontSize: "1.5rem", marginBottom: 12 }}>Xbox Live</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 24, minHeight: 40 }}>
              {uk ? "Статистика досягнень та ігор екосистеми Microsoft." : "Achievements and game stats from Microsoft ecosystem."}
            </p>
            <button className="btn btn-outline" style={{ width: "100%", padding: "12px", borderColor: "#107C10", color: "#107C10", cursor: "not-allowed" }}>
              {uk ? "🚀 В розробці" : "🚀 Coming Soon"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // --- СТАНДАРТНИЙ ДАШБОРД (Якщо є ігри) ---
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

      {/* RECENT + TOP */}
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
    </div>
  );
}