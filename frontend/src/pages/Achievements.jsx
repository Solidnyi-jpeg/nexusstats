import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";
import { getOverview, getRareAchievements } from "../api";

// --- Допоміжні функції для кольорів ---
function rarityColor(p) {
  if (p <= 5)  return "#f8c63a";
  if (p <= 15) return "#ab47bc";
  if (p <= 30) return "#66c0f4";
  if (p <= 60) return "#4caf50";
  return "var(--text-secondary)";
}

function rarityBg(p) {
  if (p <= 5)  return "rgba(248,198,58,.1)";
  if (p <= 15) return "rgba(171,71,188,.1)";
  if (p <= 30) return "rgba(102,192,244,.1)";
  if (p <= 60) return "rgba(76,175,80,.1)";
  return "var(--bg-hover)";
}

// --- Компонент-картка досягнення (чистий Hover) ---
function AchievementCard({ a, uk, navigate }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [gameIconError, setGameIconError] = useState(false);

  const isClickable = a.platform && a.platform_game_id && a.platform_game_id !== "undefined";

  const handleClick = () => {
    if (isClickable) navigate(`/games/${a.platform}/${a.platform_game_id}`);
  };

  // ФІКС: Безпечно дістаємо відсоток, щоб 0.0 не перетворювався на 100
  const rarityPercent = typeof a.rarity_percent === 'number' ? a.rarity_percent : 0;
  
  // ФІКС: Визначаємо іконку (якщо не відкрито, намагаємося використати сіру)
  const isUnlocked = a.achieved !== false; // За замовчуванням вважаємо відкритим, якщо немає поля
  const currentIconUrl = (!isUnlocked && a.icon_gray_url) ? a.icon_gray_url : a.icon_url;

  return (
    <div
      role={isClickable ? "button" : "presentation"}
      tabIndex={isClickable ? 0 : -1}
      className={`card ${!isUnlocked ? "locked" : ""}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "12px 14px",
        display: "flex", gap: 12, alignItems: "center",
        cursor: isClickable ? "pointer" : "default",
        borderLeft: `3px solid ${isUnlocked ? rarityColor(rarityPercent) : "var(--border)"}`,
        transition: "opacity 0.15s, transform 0.15s, border-color 0.15s",
        opacity: isHovered && isClickable ? 0.9 : (!isUnlocked ? 0.6 : 1), // Робимо невідкриті прозорішими
        transform: isHovered && isClickable ? "translateY(-2px)" : "none",
        borderColor: isHovered && isClickable ? "var(--accent)" : "var(--border)",
        background: !isUnlocked ? "var(--bg-card-darker, rgba(0,0,0,0.2))" : "var(--bg-card)"
      }}
    >
      {/* Іконка досягнення */}
      <div style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0, overflow: "hidden", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {currentIconUrl && !imgError
          ? <img src={currentIconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: !isUnlocked ? "grayscale(100%)" : "none" }} onError={() => setImgError(true)} />
          : <span style={{ fontSize: "1.3rem", opacity: !isUnlocked ? 0.5 : 1 }} aria-hidden="true">🏆</span>
        }
      </div>

      {/* Інфо */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: !isUnlocked ? "var(--text-secondary)" : "var(--text-bright)", fontWeight: 600, fontSize: ".9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.display_name}
        </div>
        {a.description && (
          <div style={{ color: "var(--text-secondary)", fontSize: ".73rem", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {a.description}
          </div>
        )}
        {/* Гра */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
          {a.game_icon && !gameIconError && (
            <img src={a.game_icon} alt="" style={{ width: 14, height: 14, borderRadius: 2, filter: !isUnlocked ? "grayscale(100%) opacity(70%)" : "none" }} onError={() => setGameIconError(true)} />
          )}
          <span style={{ color: "var(--text-secondary)", fontSize: ".7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {a.game_name}
          </span>
        </div>
      </div>

      {/* Рідкість */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={{
          background: isUnlocked ? rarityBg(rarityPercent) : "var(--bg-hover)",
          color: isUnlocked ? rarityColor(rarityPercent) : "var(--text-secondary)",
          border: `1px solid ${isUnlocked ? rarityColor(rarityPercent) + '44' : 'var(--border)'}`,
          borderRadius: 4, padding: "2px 8px",
          fontSize: ".7rem", fontWeight: 700, whiteSpace: "nowrap",
        }}>
          {rarityPercent.toFixed(1)}% {uk ? "гравців" : "players"}
        </span>
        {a.unlock_time && isUnlocked && (
          <span style={{ color: "var(--text-secondary)", fontSize: ".68rem" }}>
            {new Date(typeof a.unlock_time === "number" ? a.unlock_time * 1000 : a.unlock_time)
              .toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short" })}
          </span>
        )}
        {!isUnlocked && (
          <span style={{ color: "var(--text-secondary)", fontSize: ".68rem" }}>
             🔒 {uk ? "Заблоковано" : "Locked"}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Компонент-картка Гри ---
function GameStatCard({ g, navigate }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const pct = g.achievement_percent || 0;
  const barColor = pct === 100 ? "var(--accent-gold)" : pct >= 75 ? "var(--accent-green)" : pct >= 40 ? "var(--accent)" : "var(--accent-purple)";
  const isClickable = g.platform && g.platform_game_id;

  const handleClick = () => {
    if (isClickable) navigate(`/games/${g.platform}/${g.platform_game_id}`);
  };

  return (
    <div
      role={isClickable ? "button" : "presentation"}
      tabIndex={isClickable ? 0 : -1}
      className="card"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        padding: 16, 
        cursor: isClickable ? "pointer" : "default", 
        transition: "border-color .15s ease",
        borderColor: isHovered && isClickable ? "var(--accent)" : "var(--border)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {g.img_icon_url && !imgError && (
          <img src={g.img_icon_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }} onError={() => setImgError(true)} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{g.name}</span>
            {pct === 100 && <span aria-hidden="true">🏅</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width .5s" }} />
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: ".82rem", whiteSpace: "nowrap", minWidth: 100, textAlign: "right" }}>
              {g.achievement_count}/{g.achievement_total} ({pct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Головний компонент ---
export default function Achievements() {
  const navigate = useNavigate();
  const { language } = useApp();
  const uk = language === "uk";

  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("achievements"); 
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("rarity");
  const [filterStatus, setFilterStatus] = useState("all"); // ФІКС: Новий фільтр статусів

  useEffect(() => {
    Promise.all([
      getOverview(),
      getRareAchievements(1000) // Трохи збільшив ліміт
    ])
      .then(([overviewRes, rareRes]) => {
        setStats(overviewRes.data);
        setAchievements(Array.isArray(rareRes.data) ? rareRes.data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: "2.5rem" }} aria-hidden="true">🏆</div>
      <div style={{ color: "var(--accent)" }}>{uk ? "Завантаження..." : "Loading..."}</div>
    </div>
  );

  const sorted = [...achievements].sort((a, b) => {
    // Спочатку сортуємо закриті/відкриті (завжди відкриті зверху)
    const aUnlocked = a.achieved !== false;
    const bUnlocked = b.achieved !== false;
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;

    // Потім за обраним параметром
    const rarityA = typeof a.rarity_percent === 'number' ? a.rarity_percent : 0;
    const rarityB = typeof b.rarity_percent === 'number' ? b.rarity_percent : 0;
    
    if (sort === "rarity") return rarityA - rarityB;
    if (sort === "game")   return (a.game_name || "").localeCompare(b.game_name || "");
    if (sort === "name")   return (a.display_name || "").localeCompare(b.display_name || "");
    return 0;
  });

  const filtered = sorted.filter(a => {
    // 1. Фільтр по статусу (всі, відкриті, закриті)
    const isUnlocked = a.achieved !== false;
    if (filterStatus === "unlocked" && !isUnlocked) return false;
    if (filterStatus === "locked" && isUnlocked) return false;

    // 2. Фільтр по пошуку
    if (!search) return true;
    const s = search.toLowerCase();
    return (a.display_name || "").toLowerCase().includes(s) ||
           (a.game_name || "").toLowerCase().includes(s);
  });

  const total    = stats?.total_possible_achievements || 0;
  const achieved = stats?.total_achievements || 0;
  const locked   = Math.max(0, total - achieved);
  const pct      = stats?.achievement_completion || 0;

  const gameStats = (stats?.top_games || []).filter(g => g.achievement_total > 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ color: "var(--text-bright)", fontSize: "1.5rem" }}>
          🏆 {uk ? "Досягнення" : "Achievements"}
        </h1>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={`btn ${view === "achievements" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("achievements")}>
            🏅 {uk ? "Всі" : "All"}
          </button>
          <button className={`btn ${view === "games" ? "btn-primary" : "btn-outline"}`} onClick={() => setView("games")}>
            🎮 {uk ? "По іграх" : "By Games"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { icon: "🏆", label: uk ? "Всього можливих" : "Total Possible", value: total,   color: "var(--accent-gold)" },
          { icon: "✅", label: uk ? "Отримано"         : "Unlocked",       value: achieved, color: "var(--accent-green)" },
          { icon: "🔒", label: uk ? "Залишилось"       : "Locked",         value: locked,   color: "var(--text-secondary)" },
          { icon: "📊", label: uk ? "Виконання"        : "Completion",     value: `${pct}%`, color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem" }} aria-hidden="true">{s.icon}</div>
            <div style={{ color: s.color, fontSize: "1.4rem", fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: ".75rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Achievements view */}
      {view === "achievements" && (
        <>
          {/* Controls */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            
            {/* ФІКС: Новий селект для статусу */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: "6px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-primary)", fontSize: ".85rem", cursor: "pointer" }}
            >
              <option value="all">{uk ? "Всі статуси" : "All statuses"}</option>
              <option value="unlocked">{uk ? "Тільки отримані" : "Unlocked only"}</option>
              <option value="locked">{uk ? "Тільки заблоковані" : "Locked only"}</option>
            </select>

            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{ padding: "6px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-primary)", fontSize: ".85rem", cursor: "pointer" }}
            >
              <option value="rarity">{uk ? "За рідкістю" : "By rarity"}</option>
              <option value="game">{uk ? "За грою" : "By game"}</option>
              <option value="name">{uk ? "За назвою" : "By name"}</option>
            </select>
            
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={uk ? "🔍 Пошук..." : "🔍 Search..."}
              style={{ marginLeft: "auto", padding: "6px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-primary)", fontSize: ".85rem", width: "100%", maxWidth: 250, outline: "none" }}
            />
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", marginBottom: 12 }}>
            {uk ? "Показано" : "Showing"}: {filtered.length}
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
              {uk ? "Досягнень не знайдено." : "No achievements found."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 10 }}>
              {filtered.map(a => (
                <AchievementCard key={`${a.id}-${a.api_name}`} a={a} uk={uk} navigate={navigate} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Games view */}
      {view === "games" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {gameStats.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
              {uk ? "Немає даних" : "No data"}
            </div>
          )}
          {gameStats.map(g => (
            <GameStatCard key={g.game_id} g={g} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}