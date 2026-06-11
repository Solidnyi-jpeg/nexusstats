import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom"; // ФІКС 1: Додали useSearchParams
import { useApp } from "../store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getGameDetail, getGameAchievements } from "../api";

/* ---------- helpers ---------- */
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

/* ---------- Скріншот модалка ---------- */
function ScreenshotModal({ screenshots, start, onClose }) {
  const [idx, setIdx] = useState(start);
  const prev = useCallback(() => setIdx(i => (i - 1 + screenshots.length) % screenshots.length), [screenshots.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % screenshots.length), [screenshots.length]);

  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, prev, next]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.93)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw" }}>
        <img
          src={(screenshots[idx] || "").replace("thumbnail", "full")}
          alt=""
          style={{ maxWidth: "90vw", maxHeight: "82vh", borderRadius: 8, display: "block" }}
        />
        {screenshots.length > 1 && (
          <>
            <button onClick={prev} style={{ position: "absolute", left: -56, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: "50%", width: 44, height: 44, color: "#fff", fontSize: "1.3rem", cursor: "pointer" }}>‹</button>
            <button onClick={next} style={{ position: "absolute", right: -56, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: "50%", width: 44, height: 44, color: "#fff", fontSize: "1.3rem", cursor: "pointer" }}>›</button>
          </>
        )}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,.5)", marginTop: 10, fontSize: ".8rem" }}>
          {idx + 1} / {screenshots.length} · <span style={{ cursor: "pointer", color: "#fff" }} onClick={onClose}>✕ закрити</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Розумний і реалістичний Календар активності ---------- */
function ActivityCalendar({ totalHours, recentHours, uk }) {
  const [tooltip, setTooltip] = useState(null);
  const WEEKS = 26;
  const DAYS = WEEKS * 7;
  const today = new Date();

  // ФІКС 3: Повністю перероблений алгоритм, який генерує "сесії" замість роботизації
  const cells = useMemo(() => {
    const historicHours = Math.max(0, totalHours - recentHours);
    
    // Створюємо псевдорандом на основі індексу, щоб графік не блимав при ререндері
    const seededRandom = (seed) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const distributeHours = (hours, daysCount, seedOffset) => {
      let arr = new Array(daysCount).fill(0);
      if (hours <= 0) return arr;

      // Припускаємо середню ігрову сесію ~2.5 години
      let activeDaysCount = Math.min(daysCount, Math.ceil(hours / 2.5));
      if (activeDaysCount === 0 && hours > 0) activeDaysCount = 1;

      let indices = Array.from({ length: daysCount }, (_, i) => i);
      
      // Детерміноване перемішування (shuffle)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.abs(seededRandom(i + seedOffset + hours)) * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      let selectedIndices = indices.slice(0, activeDaysCount);
      let remaining = hours;

      // Розкидаємо години органічно
      for (let i = 0; i < selectedIndices.length - 1; i++) {
        let maxAvg = remaining / (selectedIndices.length - i);
        let val = Math.abs(seededRandom(selectedIndices[i] + seedOffset)) * maxAvg * 1.5;
        if (val < 0.5) val = 0.5; // Мінімум 30 хв
        if (val > 12) val = 12;   // Максимум 12 годин на день
        if (val > remaining) val = remaining;
        
        val = Math.round(val * 10) / 10;
        arr[selectedIndices[i]] = val;
        remaining -= val;
      }
      
      // Залишок кидаємо в останній день
      if (remaining > 0) {
        let lastIdx = selectedIndices[selectedIndices.length - 1];
        arr[lastIdx] = Math.round((arr[lastIdx] + remaining) * 10) / 10;
        if (arr[lastIdx] > 24) arr[lastIdx] = 24;
      }
      return arr;
    };

    const historicArr = distributeHours(historicHours, DAYS - 14, totalHours);
    const recentArr = distributeHours(recentHours, 14, totalHours + 100);
    const combinedArr = [...historicArr, ...recentArr];

    return combinedArr.map((h, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (DAYS - i - 1));
      return { date: d, h };
    });
  }, [totalHours, recentHours, DAYS, today]);

  const color = h => {
    if (!h)   return "var(--border)";
    if (h < 1) return "#1a3a2a";
    if (h < 2) return "#2d6e42";
    if (h < 4) return "#40a060";
    return "#4caf50";
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{ width: 13, height: 13, borderRadius: 2, background: color(c.h), cursor: "default", transition: "transform .1s", flexShrink: 0 }}
            onMouseEnter={e => {
              e.target.style.transform = "scale(1.5)";
              const r = e.target.getBoundingClientRect();
              setTooltip({ x: r.left + r.width / 2, y: r.top - 36, date: c.date.toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short" }), h: c.h });
            }}
            onMouseLeave={e => { e.target.style.transform = "scale(1)"; setTooltip(null); }}
          />
        ))}
      </div>
      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x, top: tooltip.y, transform: "translateX(-50%)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: ".73rem", pointerEvents: "none", zIndex: 999, whiteSpace: "nowrap" }}>
          <div style={{ color: "var(--text-secondary)" }}>{tooltip.date}</div>
          <div style={{ color: tooltip.h > 0 ? "#4caf50" : "var(--text-secondary)", fontWeight: 600 }}>
            {tooltip.h > 0 ? `${tooltip.h} год` : uk ? "Без активності" : "No activity"}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
        <span style={{ color: "var(--text-secondary)", fontSize: ".7rem" }}>{uk ? "Менше" : "Less"}</span>
        {[0, 0.5, 1.5, 3, 5].map((h, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: color(h) }} />
        ))}
        <span style={{ color: "var(--text-secondary)", fontSize: ".7rem" }}>{uk ? "Більше" : "More"}</span>
      </div>
    </div>
  );
}

/* ---------- Головний компонент ---------- */
export default function GameDetail() {
  const { platform, gameId } = useParams();
  const navigate = useNavigate();
  
  // ФІКС 1: Дістаємо steamId друга з URL-адреси
  const [searchParams] = useSearchParams();
  const viewerSteamId = searchParams.get("viewer_steam_id");

  const { language } = useApp();
  const uk = language === "uk";

  const [data, setData] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    setLoading(true);
    
    // ФІКС 2: Передаємо viewerSteamId в API, щоб бекенд знав, чию статистику тягнути!
    Promise.all([
      getGameDetail(platform, gameId, viewerSteamId),
      getGameAchievements(gameId, viewerSteamId)
    ])
      .then(([gameRes, achRes]) => {
        setData(gameRes.data);
        
        const sortedAchs = (achRes.data || []).sort((a, b) => {
          const aUnlocked = a.achieved !== false;
          const bUnlocked = b.achieved !== false;
          if (aUnlocked && !bUnlocked) return -1;
          if (!aUnlocked && bUnlocked) return 1;
          
          const rarityA = typeof a.rarity_percent === 'number' ? a.rarity_percent : 0;
          const rarityB = typeof b.rarity_percent === 'number' ? b.rarity_percent : 0;
          return rarityA - rarityB;
        });
        
        setAchievements(sortedAchs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [platform, gameId, viewerSteamId]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ color: "var(--accent)" }}>{uk ? "Завантаження..." : "Loading..."}</div>
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--accent-red)" }}>
      {uk ? "Помилка завантаження" : "Failed to load"}
    </div>
  );

  const { game, player_stats, store, news, is_synced } = data; // Очікуємо is_synced від бекенда
  const screenshots = (store?.screenshots || []).filter(Boolean);
  const achUnlocked = achievements.filter(a => a.achieved !== false);

  const tabs = [
    { key: "overview",      label: `📖 ${uk ? "Огляд" : "Overview"}` },
    { key: "achievements",  label: `🏆 ${uk ? "Досягнення" : "Achievements"} (${achievements.length})` },
    { key: "news",          label: `📰 ${uk ? "Новини" : "News"}` },
  ];

  // Перевірка: чи показувати календар? Показуємо якщо це мій профіль (!viewerSteamId), або якщо друг зареєстрований (is_synced !== false)
  const showCalendar = !viewerSteamId || is_synced !== false;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      {modal !== null && <ScreenshotModal screenshots={screenshots} start={modal} onClose={() => setModal(null)} />}

      <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginBottom: 20 }}>
        ← {uk ? "Назад" : "Back"}
      </button>

      {/* Hero */}
      <div className="card" style={{ marginBottom: 20, overflow: "hidden", backgroundImage: store?.header_image ? `url(${store.header_image})` : "none", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div style={{ background: "linear-gradient(to right, var(--bg-card) 50%, rgba(22,32,45,.6))", padding: 28 }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-bright)", fontSize: "1.7rem", marginBottom: 6 }}>{game?.name || "Game"}</h1>
              {store?.developers?.length > 0 && (
                <div style={{ color: "var(--text-secondary)", fontSize: ".85rem", marginBottom: 10 }}>
                  {uk ? "Розробник" : "Developer"}: {store.developers.join(", ")}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(store?.genres || []).map(g => (
                  <span key={g} style={{ background: "var(--bg-hover)", color: "var(--accent)", borderRadius: 4, padding: "2px 10px", fontSize: ".73rem" }}>{g}</span>
                ))}
              </div>
            </div>
            {store?.metacritic && (
              <div style={{ background: store.metacritic >= 75 ? "#4caf50" : store.metacritic >= 50 ? "#f8c63a" : "#ef5350", color: "#fff", borderRadius: 8, padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.7rem", fontWeight: "bold" }}>{store.metacritic}</div>
                <div style={{ fontSize: ".7rem" }}>Metacritic</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {player_stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { icon: "⏱️", label: uk ? "Загальний час" : "Total Playtime", value: `${player_stats.playtime_hours}h`,         color: "var(--accent-gold)" },
            { icon: "🕐", label: uk ? "За 2 тижні"   : "Last 2 Weeks",   value: `${player_stats.playtime_2weeks_hours}h`,  color: "var(--accent-green)" },
            { icon: "🏆", label: uk ? "Досягнення"   : "Achievements",   value: `${player_stats.achievement_count}/${player_stats.achievement_total}`, color: "var(--accent-purple)" },
            { icon: "📊", label: uk ? "Прогрес"      : "Completion",     value: player_stats.achievement_total > 0 ? `${player_stats.completion_percent}%` : "—", color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem" }}>{s.icon}</div>
              <div style={{ color: s.color, fontSize: "1.3rem", fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: ".73rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ФІКС 4: Календар показується тільки якщо це ти, АБО друг синхронізований */}
      {player_stats && showCalendar && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ color: "var(--text-bright)", marginBottom: 16, fontSize: "1rem" }}>
            📅 {uk ? "Календар активності" : "Activity Calendar"}
          </h3>
          <ActivityCalendar
            totalHours={player_stats?.playtime_hours || 0}
            recentHours={player_stats?.playtime_2weeks_hours || 0}
            uk={uk}
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-outline"}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {store?.description && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ color: "var(--text-bright)", marginBottom: 12, fontSize: "1rem" }}>{uk ? "Про гру" : "About"}</h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>{store.description}</p>
            </div>
          )}
          {screenshots.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ color: "var(--text-bright)", marginBottom: 16, fontSize: "1rem" }}>🖼️ {uk ? "Скріншоти" : "Screenshots"}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {screenshots.map((src, i) => (
                  <div key={i} onClick={() => setModal(i)} style={{ borderRadius: 6, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", border: "1px solid var(--border)" }}>
                    <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Achievements */}
      {tab === "achievements" && (
        <div className="card" style={{ padding: 24 }}>
          {achievements.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              {uk ? "Немає даних про досягнення для цієї гри" : "No achievements data for this game"}
            </div>
          ) : (
            <>
              <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", marginBottom: 16 }}>
                {achUnlocked.length}/{achievements.length} {uk ? "отримано" : "unlocked"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {achievements.map(a => {
                  const isUnlocked = a.achieved !== false;
                  const currentIconUrl = (!isUnlocked && a.icon_gray_url) ? a.icon_gray_url : a.icon_url;
                  const rarityPercent = typeof a.rarity_percent === 'number' ? a.rarity_percent : 0;

                  return (
                    <div
                      key={a.api_name}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 12px", borderRadius: 8,
                        background: isUnlocked ? "var(--bg-hover)" : "var(--bg-card-darker, rgba(0,0,0,0.2))",
                        opacity: isUnlocked ? 1 : 0.6,
                        border: `1px solid ${isUnlocked ? rarityColor(rarityPercent) + "44" : "var(--border)"}`,
                        borderLeft: `3px solid ${isUnlocked ? rarityColor(rarityPercent) : "var(--border)"}`,
                      }}
                    >
                      {/* Іконка */}
                      <div style={{ width: 42, height: 42, borderRadius: 6, flexShrink: 0, overflow: "hidden", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {currentIconUrl
                          ? <img src={currentIconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: !isUnlocked ? "grayscale(100%)" : "none" }} onError={e => { e.target.style.display = "none"; }} />
                          : <span style={{ fontSize: "1.1rem", opacity: !isUnlocked ? 0.5 : 1 }}>{isUnlocked ? "🏆" : "🔒"}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: isUnlocked ? "var(--text-bright)" : "var(--text-secondary)", fontWeight: 600, fontSize: ".9rem" }}>
                          {a.display_name}
                        </div>
                        {a.description && (
                          <div style={{ color: "var(--text-secondary)", fontSize: ".75rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.description}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ background: isUnlocked ? rarityBg(rarityPercent) : "var(--bg-hover)", color: isUnlocked ? rarityColor(rarityPercent) : "var(--text-secondary)", border: `1px solid ${isUnlocked ? rarityColor(rarityPercent) + '44' : 'var(--border)'}`, borderRadius: 4, padding: "2px 8px", fontSize: ".7rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {rarityPercent.toFixed(1)}%
                        </span>
                        {!isUnlocked && (
                          <span style={{ color: "var(--text-secondary)", fontSize: ".68rem" }}>
                            🔒 {uk ? "Заблоковано" : "Locked"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* News */}
      {tab === "news" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!news || news.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
              {uk ? "Новин немає" : "No news available"}
            </div>
          ) : news.map((n, i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <h4 style={{ color: "var(--text-bright)", margin: "0 0 8px 0" }}>{n.title}</h4>
              <p style={{ color: "var(--text-secondary)", fontSize: ".85rem", lineHeight: 1.6, margin: "0 0 12px 0" }}>{n.contents}</p>
              {n.url && (
                <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: ".85rem", fontWeight: 600, textDecoration: "none" }}>
                  {uk ? "Читати у Steam ↗" : "Read on Steam ↗"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}