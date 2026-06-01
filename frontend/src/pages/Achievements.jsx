import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function Achievements() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isUk = i18n.language === "uk";
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("achievements");
  const [search, setSearch] = useState("");
  const [showOnlyAchieved, setShowOnlyAchieved] = useState(false);
  const [sortBy, setSortBy] = useState("rarity");

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      const overviewRes = await fetch("http://localhost:8000/api/v1/analytics/overview", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const overview = await overviewRes.json();

      const rareRes = await fetch("http://localhost:8000/api/v1/analytics/achievements/rare?limit=100", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const rareList = await rareRes.json();

      const totalPossible = overview.total_possible_achievements || 0;
      const totalAchieved = overview.total_achievements || 0;

      const formattedData = {
        total: totalPossible,
        achieved_count: totalAchieved,
        locked_count: Math.max(0, totalPossible - totalAchieved),
        completion_percent: overview.achievement_completion || 0,
        achievements: (rareList || []).map(a => ({
          id: a.id,
          api_name: a.api_name,
          display_name: a.display_name || a.api_name,
          description: a.description,
          icon_url: a.icon_url,
          achieved: true, // ВИПРАВЛЕНО: true (lowercase)
          unlock_time: a.unlock_time,
          game_name: a.game_name,
          platform: a.platform,
          platform_game_id: a.platform_game_id,
          rarity_percent: a.rarity_percent,
          has_real_percent: true // ВИПРАВЛЕНО: true (lowercase)
        })),
        games_stats: (overview.top_games || []).map(g => ({
          game_name: g.name,
          game_icon: g.img_icon_url,
          achieved: g.achievement_count,
          total: g.achievement_total,
          percent: g.achievement_percent,
          platform: g.platform,
          platform_game_id: g.platform_game_id
        }))
      };

      setData(formattedData);
    } catch (err) {
      console.error("Помилка зчитування глобальних досягнень:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "2.5rem" }}>🏆</div>
      <div style={{ color: "var(--accent)" }}>{t("common.loading") || (isUk ? "Завантаження..." : "Loading...")}</div>
    </div>
  );

  if (!data || data.total === 0) return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🏆</div>
      <div style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: "24px" }}>
        {isUk ? "Немає доступних досягнень. Дочекайтеся фонової індексації профілю." : "No achievements available yet. Please wait for sync."}
      </div>
      <button className="btn btn-primary" onClick={fetchData}>{t("common.retry") || (isUk ? "Повторити спробу" : "Retry")}</button>
    </div>
  );

  const sorted = [...data.achievements].sort((a, b) => {
    if (sortBy === "rarity") return (a.rarity_percent || 0) - (b.rarity_percent || 0);
    if (sortBy === "name") return (a.display_name || '').localeCompare(b.display_name || '');
    if (sortBy === "date") return (b.unlock_time || 0) - (a.unlock_time || 0);
    if (sortBy === "game") return (a.game_name || '').localeCompare(b.game_name || '');
    return 0;
  });

  const filtered = sorted.filter(a => {
    if (showOnlyAchieved && !a.achieved) return false;
    if (search && !a.display_name.toLowerCase().includes(search.toLowerCase()) &&
        !a.game_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true; // ВИПРАВЛЕНО: true (lowercase)
  });

  const getPercentColor = (percent) => {
    if (!percent) return "var(--text-secondary)";
    if (percent <= 5)  return "#f8c63a";  
    if (percent <= 15) return "#ab47bc";  
    if (percent <= 30) return "#66c0f4";  
    if (percent <= 60) return "#4caf50";  
    return "var(--text-secondary)";       
  };

  const getPercentBg = (percent) => {
    if (!percent) return "var(--bg-hover)";
    if (percent <= 5)  return "#f8c63a18";
    if (percent <= 15) return "#ab47bc18";
    if (percent <= 30) return "#66c0f418";
    if (percent <= 60) return "#4caf5018";
    return "var(--bg-hover)";
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 24px" }}>
      {/* (Код верстки залишається твоїм, він був вірним) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: "var(--text-bright)", fontSize: "1.5rem" }}>
          🏆 {isUk ? "Глобальний кабінет досягнень" : "Global Achievements Cabinet"}
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className={`btn ${view === "achievements" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setView("achievements")}>
            🏅 {isUk ? "Досягнення" : "Achievements"}
          </button>
          <button className={`btn ${view === "games" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setView("games")}>
            🎮 {isUk ? "По іграх" : "By Games"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: isUk ? "Всього в системі" : "Total Possible", value: data.total, icon: "🏆", color: "var(--accent-gold)" },
          { label: isUk ? "Отримано вами" : "Unlocked By You", value: data.achieved_count, icon: "✅", color: "var(--accent-green)" },
          { label: isUk ? "Залишилось" : "Locked", value: data.locked_count, icon: "🔒", color: "var(--text-secondary)" },
          { label: isUk ? "Середній прогрес" : "Completion Rate", value: `${data.completion_percent}%`, icon: "📊", color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: "1.4rem", fontWeight: "bold" }}>{s.value}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {view === "achievements" && (
        <>
          {/* Controls */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <button className={`btn ${showOnlyAchieved ? "btn-primary" : "btn-outline"}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
              onClick={() => setShowOnlyAchieved(v => !v)}>
              ✅ {isUk ? "Тільки отримані" : "Unlocked only"}
            </button>

            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{
                padding: "6px 12px", background: "var(--bg-card)",
                border: "1px solid var(--border)", borderRadius: "var(--radius)",
                color: "var(--text-primary)", fontSize: "0.82rem", cursor: "pointer",
              }}>
              <option value="rarity">{isUk ? "За рідкістю" : "By rarity"}</option>
              <option value="date">{isUk ? "За датою" : "By date"}</option>
              <option value="game">{isUk ? "За грою" : "By game"}</option>
              <option value="name">{isUk ? "За назвою" : "By name"}</option>
            </select>

            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isUk ? "🔍 Пошук..." : "🔍 Search..."}
              style={{
                marginLeft: "auto", padding: "6px 14px",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", color: "var(--text-primary)",
                outline: "none", fontSize: "0.85rem", width: "200px",
              }} />
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "12px" }}>
            {isUk ? "Показано" : "Showing"}: {filtered.length} / {data.achievements.length}
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "10px" }}>
            {filtered.map(a => (
              <div key={`${a.id}-${a.api_name}`}
                className="card"
                style={{
                  padding: "14px", display: "flex", gap: "12px",
                  opacity: a.achieved ? 1 : 0.5,
                  cursor: "pointer", transition: "all 0.15s",
                  borderLeft: `3px solid ${getPercentColor(a.rarity_percent)}`,
                }}
                onClick={() => navigate(`/games/${a.platform}/${a.platform_game_id}`)}
                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = a.achieved ? "1" : "0.5"; e.currentTarget.style.transform = "none"; }}
              >
                {/* Icon */}
                <div style={{
                  width: "52px", height: "52px", borderRadius: "6px", flexShrink: 0,
                  overflow: "hidden", background: "var(--bg-hover)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {a.icon_url ? (
                    <img src={a.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : <div style={{ fontSize: "1.4rem" }}>🏆</div>}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text-bright)", fontSize: "0.88rem", fontWeight: "600", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {a.display_name}
                  </div>
                  {a.description && (
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.73rem", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.description}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>
                      {a.game_name}
                    </span>

                    {a.has_real_percent && (
                      <span style={{
                        marginLeft: "auto",
                        background: getPercentBg(a.rarity_percent),
                        color: getPercentColor(a.rarity_percent),
                        border: `1px solid ${getPercentColor(a.rarity_percent)}44`,
                        borderRadius: "4px", padding: "1px 7px",
                        fontSize: "0.7rem", fontWeight: "700", whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                        {a.rarity_percent}% {isUk ? "гравців" : "players"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Unlock date */}
                <div style={{ flexShrink: 0, textAlign: "right", minWidth: "56px" }}>
                  {a.achieved && a.unlock_time ? (
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem", lineHeight: 1.4 }}>
                      {new Date(a.unlock_time * 1000).toLocaleDateString(isUk ? "uk-UA" : "en-US", { day: "numeric", month: "short" })}
                    </div>
                  ) : !a.achieved ? (
                    <div style={{ color: "var(--border)", fontSize: "1rem" }}>🔒</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "games" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {data.games_stats.map(g => (
            <div key={g.game_name} className="card"
              style={{ padding: "16px", cursor: "pointer", transition: "border-color 0.15s" }}
              onClick={() => navigate(`/games/${g.platform}/${g.platform_game_id}`)}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {g.game_icon && (
                  <img src={g.game_icon} style={{ width: "40px", height: "40px", borderRadius: "6px", flexShrink: 0 }} alt="" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ color: "var(--text-bright)", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {g.game_name}
                    </span>
                    {g.percent === 100 && <span>🏅</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ flex: 1, height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{
                        width: `${g.percent}%`, height: "100%", borderRadius: "4px",
                        background: g.percent === 100 ? "var(--accent-gold)" : g.percent >= 75 ? "var(--accent-green)" : g.percent >= 40 ? "var(--accent)" : "var(--accent-purple)",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem", flexShrink: 0, minWidth: "90px", textAlign: "right" }}>
                      {g.achieved}/{g.total} ({g.percent}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}