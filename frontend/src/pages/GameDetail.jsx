import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";

function ScreenshotModal({ screenshots, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);

  const prev = useCallback(() => setIdx(i => (i - 1 + screenshots.length) % screenshots.length), [screenshots.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % screenshots.length), [screenshots.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
        <img
          src={screenshots[idx]?.replace("thumbnail", "full") || screenshots[idx]}
          alt=""
          style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: "8px", display: "block" }}
        />
        {screenshots.length > 1 && (
          <>
            <button onClick={prev} style={{
              position: "absolute", left: "-60px", top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%", width: "48px", height: "48px", color: "#fff",
              fontSize: "1.3rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <button onClick={next} style={{
              position: "absolute", right: "-60px", top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%", width: "48px", height: "48px", color: "#fff",
              fontSize: "1.3rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
          </>
        )}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", marginTop: "12px", fontSize: "0.85rem" }}>
          {idx + 1} / {screenshots.length} · ESC {" "}
          <span style={{ cursor: "pointer", color: "#fff" }} onClick={onClose}>✕</span>
        </div>
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginTop: "10px", flexWrap: "wrap" }}>
          {screenshots.map((s, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{
              width: "50px", height: "32px", borderRadius: "3px", overflow: "hidden",
              border: `2px solid ${i === idx ? "#66c0f4" : "transparent"}`,
              cursor: "pointer", flexShrink: 0,
            }}>
              <img src={s} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityCalendar({ playtimeHours }) {
  const [tooltip, setTooltip] = useState(null);
  const weeks = 26;
  const days = weeks * 7;
  const today = new Date();

  const data = Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - i - 1));
    const seed = (date.getDate() * 13 + date.getMonth() * 7 + i * 3) % 100;
    const threshold = playtimeHours > 100 ? 35 : playtimeHours > 50 ? 25 : playtimeHours > 20 ? 15 : 8;
    const hasActivity = seed < threshold;
    const hours = hasActivity ? parseFloat(((seed % 4) + 0.5).toFixed(1)) : 0;
    return { date, hours };
  });

  const getColor = (hours) => {
    if (hours === 0) return "var(--border)";
    if (hours < 1)  return "#1a3a2a";
    if (hours < 2)  return "#2d6e42";
    if (hours < 3)  return "#40a060";
    return "var(--accent-green)";
  };

  const months = [];
  data.forEach((d, i) => {
    if (d.date.getDate() === 1 || i === 0) {
      months.push({
        label: d.date.toLocaleString("default", { month: "short" }),
        index: i,
      });
    }
  });

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              width: "13px", height: "13px", borderRadius: "2px",
              background: getColor(d.hours),
              cursor: "default", flexShrink: 0,
              transition: "transform 0.1s",
            }}
            onMouseEnter={e => {
              e.target.style.transform = "scale(1.4)";
              const rect = e.target.getBoundingClientRect();
              setTooltip({
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY - 36,
                date: d.date.toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" }),
                hours: d.hours,
              });
            }}
            onMouseLeave={e => {
              e.target.style.transform = "scale(1)";
              setTooltip(null);
            }}
          />
        ))}
      </div>

      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x, top: tooltip.y,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "6px", padding: "6px 10px",
          fontSize: "0.75rem", color: "var(--text-primary)",
          pointerEvents: "none", zIndex: 999, whiteSpace: "nowrap",
          transform: "translateX(-50%)",
        }}>
          <div style={{ color: "var(--text-secondary)" }}>{tooltip.date}</div>
          <div style={{ color: tooltip.hours > 0 ? "var(--accent-green)" : "var(--text-secondary)", fontWeight: "600" }}>
            {tooltip.hours > 0 ? `${tooltip.hours} год` : "Без активності"}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>Менше</span>
        {[0, 0.5, 1.5, 2.5, 3.5].map((h, i) => (
          <div key={i} style={{ width: "12px", height: "12px", borderRadius: "2px", background: getColor(h) }} />
        ))}
        <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>Більше</span>
      </div>
    </div>
  );
}

export default function GameDetail() {
  const { platform, gameId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isUk = i18n.language === "uk";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:8000/games/${platform}/${gameId}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [platform, gameId]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "12px" }}>
      <div style={{ color: "var(--accent)" }}>{t("common.loading")}</div>
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: "center", padding: "60px", color: "var(--accent-red)" }}>
      {t("common.error")}
    </div>
  );

  const { game, player_stats, store, achievements, news } = data;

  const tabs = [
    { key: "overview", label: `📖 ${isUk ? "Огляд" : "Overview"}` },
    { key: "achievements", label: `🏆 ${isUk ? "Досягнення" : "Achievements"}` },
    { key: "news", label: `📰 ${isUk ? "Новини" : "News"}` },
  ];

  const screenshots = store?.screenshots?.filter(Boolean) || [];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 24px" }}>

      {modal !== null && (
        <ScreenshotModal
          screenshots={screenshots}
          startIndex={modal}
          onClose={() => setModal(null)}
        />
      )}

      <button onClick={() => navigate(-1)} style={{
        background: "none", border: "none", color: "var(--text-secondary)",
        cursor: "pointer", marginBottom: "20px", fontSize: "0.9rem",
      }}>
        {isUk ? "← Назад" : "← Back"}
      </button>

      {/* Hero */}
      <div className="card" style={{
        marginBottom: "24px", overflow: "hidden",
        backgroundImage: store?.header_image ? `url(${store.header_image})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
      }}>
        <div style={{ background: "linear-gradient(to right, var(--bg-card) 55%, rgba(22,32,45,0.7))", padding: "32px" }}>
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-bright)", fontSize: "1.8rem", marginBottom: "8px" }}>{game.name}</h1>
              {store?.developers?.length > 0 && (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "10px" }}>
                  {isUk ? "Розробник" : "Developer"}: {store.developers.join(", ")}
                </div>
              )}
              {store?.release_date && (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "10px" }}>
                  {isUk ? "Дата виходу" : "Release date"}: {store.release_date}
                </div>
              )}
              {store?.genres?.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {store.genres.map(g => (
                    <span key={g} style={{
                      background: "var(--bg-hover)", color: "var(--accent)",
                      borderRadius: "4px", padding: "2px 10px", fontSize: "0.75rem",
                    }}>{g}</span>
                  ))}
                </div>
              )}
            </div>
            {store?.metacritic && (
              <div style={{
                background: store.metacritic >= 75 ? "#4caf50" : store.metacritic >= 50 ? "#f8c63a" : "#ef5350",
                color: "#fff", borderRadius: "8px", padding: "10px 16px",
                textAlign: "center", flexShrink: 0,
              }}>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>{store.metacritic}</div>
                <div style={{ fontSize: "0.7rem" }}>Metacritic</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player stats */}
      {player_stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: isUk ? "Загальний час" : "Total Playtime", value: `${player_stats.playtime_hours}h`, icon: "⏱️", color: "var(--accent-gold)" },
            { label: isUk ? "За 2 тижні" : "Last 2 Weeks", value: `${player_stats.playtime_2weeks_hours}h`, icon: "🕐", color: "var(--accent-green)" },
            { label: isUk ? "Досягнення" : "Achievements", value: `${player_stats.achievement_count}/${player_stats.achievement_total}`, icon: "🏆", color: "var(--accent-purple)" },
            { label: isUk ? "Прогрес" : "Completion", value: player_stats.achievement_total > 0 ? `${Math.round(player_stats.achievement_count / player_stats.achievement_total * 100)}%` : "N/A", icon: "📊", color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              <div style={{ color: s.color, fontSize: "1.4rem", fontWeight: "bold" }}>{s.value}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="card" style={{ padding: "24px", marginBottom: "24px" }}>
        <h3 style={{ color: "var(--text-bright)", marginBottom: "16px", fontSize: "1rem" }}>
          📅 {isUk ? "Календар активності" : "Activity Calendar"}
        </h3>
        <ActivityCalendar playtimeHours={player_stats?.playtime_hours || 0} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`btn ${activeTab === tab.key ? "btn-primary" : "btn-outline"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div>
          {store?.description && (
            <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
              <h3 style={{ color: "var(--text-bright)", marginBottom: "12px" }}>
                {isUk ? "Про гру" : "About"}
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{store.description}</p>
            </div>
          )}

          {screenshots.length > 0 && (
            <div className="card" style={{ padding: "24px" }}>
              <h3 style={{ color: "var(--text-bright)", marginBottom: "16px" }}>
                {isUk ? "Скріншоти" : "Screenshots"}
                <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginLeft: "8px" }}>
                  ({isUk ? "натисни для перегляду" : "click to view"})
                </span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {screenshots.map((s, i) => (
                  <div key={i} onClick={() => setModal(i)} style={{
                    borderRadius: "6px", overflow: "hidden", cursor: "pointer",
                    transition: "transform 0.15s, opacity 0.15s", aspectRatio: "16/9",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.opacity = "0.85"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.opacity = "1"; }}
                  >
                    <img src={s} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Achievements */}
      {activeTab === "achievements" && (
        <div className="card" style={{ padding: "24px" }}>
          {achievements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              {isUk ? "Немає даних про досягнення" : "No achievements data"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {achievements.map(a => (
                <div key={a.api_name} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px", borderRadius: "6px",
                  background: a.achieved ? "var(--bg-hover)" : "transparent",
                  opacity: a.achieved ? 1 : 0.5,
                }}>
                  <div style={{ fontSize: "1.5rem" }}>{a.achieved ? "🏆" : "🔒"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: a.achieved ? "var(--text-bright)" : "var(--text-secondary)", fontWeight: "600" }}>
                      {a.display_name}
                    </div>
                    {a.description && (
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{a.description}</div>
                    )}
                  </div>
                  {a.achieved && a.unlock_time && (
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", flexShrink: 0 }}>
                      {new Date(a.unlock_time * 1000).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* News */}
      {activeTab === "news" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {news.length === 0 ? (
            <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
              {isUk ? "Новини недоступні" : "No news available"}
            </div>
          ) : news.map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: "20px", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                <div style={{ color: "var(--text-bright)", fontWeight: "600", marginBottom: "8px" }}>{n.title}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "8px" }}>{n.contents}...</div>
                <div style={{ color: "var(--accent)", fontSize: "0.75rem" }}>
                  {new Date(n.date * 1000).toLocaleDateString(isUk ? "uk-UA" : "en-US")} →
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
