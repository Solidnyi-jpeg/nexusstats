import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import axios from "axios";

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

  const fetchData = () => {
    setLoading(true);
    axios.get("http://localhost:8000/debug/achievements")
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "2.5rem" }}>🏆</div>
      <div style={{ color: "var(--accent)" }}>{t("common.loading")}</div>
    </div>
  );

  if (!data || data.total === 0) return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🏆</div>
      <div style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: "24px" }}>
        {t("achievements.noData")}
      </div>
      <button className="btn btn-primary" onClick={fetchData}>{t("common.retry")}</button>
    </div>
  );

  const sorted = [...data.achievements].sort((a, b) => {
    if (sortBy === "rarity") return a.rarity_percent - b.rarity_percent;
    if (sortBy === "name") return a.display_name.localeCompare(b.display_name);
    if (sortBy === "date") return (b.unlock_time || 0) - (a.unlock_time || 0);
    if (sortBy === "game") return a.game_name.localeCompare(b.game_name);
    return 0;
  });

  const filtered = sorted.filter(a => {
    if (showOnlyAchieved && !a.achieved) return false;
    if (search && !a.display_name.toLowerCase().includes(search.toLowerCase()) &&
        !a.game_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Колір по відсотку (чим рідше — тим яскравіше)
  const getPercentColor = (percent) => {
    if (!percent) return "var(--text-secondary)";
    if (percent <= 5)  return "#f8c63a";  // золотий — дуже рідко
    if (percent <= 15) return "#ab47bc";  // фіолетовий
    if (percent <= 30) return "#66c0f4";  // блакитний
    if (percent <= 60) return "#4caf50";  // зелений
    return "var(--text-secondary)";       // сірий — звичайне
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

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: "var(--text-bright)", fontSize: "1.5rem" }}>
          🏆 {t("achievements.title")}
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
          { label: isUk ? "Всього" : "Total", value: data.total, icon: "🏆", color: "var(--accent-gold)" },
          { label: isUk ? "Отримано" : "Unlocked", value: data.achieved_count, icon: "✅", color: "var(--accent-green)" },
          { label: isUk ? "Заблоковано" : "Locked", value: data.locked_count, icon: "🔒", color: "var(--text-secondary)" },
          { label: isUk ? "Прогрес" : "Completion", value: `${data.completion_percent}%`, icon: "📊", color: "var(--accent)" },
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
                    <img src={a.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={e => {
                        e.target.style.display = "none";
                        if (a.game_icon) {
                          const fb = e.target.nextSibling;
                          if (fb) fb.style.display = "block";
                        }
                      }} />
                  ) : null}
                  <img src={a.game_icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: a.icon_url ? "none" : "block" }}
                    onError={e => e.target.style.display = "none"} />
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
                    {/* Game */}
                    {a.game_icon && (
                      <img src={a.game_icon} style={{ width: "14px", height: "14px", borderRadius: "2px" }}
                        onError={e => e.target.style.display = "none"} />
                    )}
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>
                      {a.game_name}
                    </span>

                    {/* Percent badge */}
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
                  <img src={g.game_icon} style={{ width: "40px", height: "40px", borderRadius: "6px", flexShrink: 0 }}
                    onError={e => e.target.style.display = "none"} />
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
