import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../store";
import api, { getPublicProfile, getRareAchievements, syncProfileData } from "../api"; 

// Допоміжні функції для кольорів рідкості
function rColor(p) {
  if (p <= 5) return "#f8c63a";
  if (p <= 15) return "#ab47bc";
  if (p <= 30) return "#66c0f4";
  if (p <= 60) return "#4caf50";
  return "var(--text-secondary)";
}

function rBg(p) {
  if (p <= 5) return "rgba(248,198,58,.1)";
  if (p <= 15) return "rgba(171,71,188,.1)";
  if (p <= 30) return "rgba(102,192,244,.1)";
  if (p <= 60) return "rgba(76,175,80,.1)";
  return "var(--bg-hover)";
}

// Окремий компонент для рядка гри
function GameRow({ g, i, isLast, steamId, uk, navigate, isSynced }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const total = g.achievement_total || 0;
  const pct = total > 0 ? Math.round((g.achievement_count || 0) / total * 100) : 0;
  const isClickable = g.platform && g.platform_game_id;

  const handleClick = () => {
    if (!isClickable) return;
    
    if (!isSynced) {
      alert(uk 
        ? "🔒 Цей користувач не зареєстрований у NexusStats. Детальна статистика по грі недоступна." 
        : "🔒 This user is not registered in NexusStats. Detailed game stats are unavailable."
      );
      return;
    }
    
    navigate(`/games/${g.platform}/${g.platform_game_id}?viewer_steam_id=${steamId}`);
  };

  return (
    <div
      role={isClickable ? "button" : "presentation"}
      tabIndex={isClickable ? 0 : -1}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 10px", borderRadius: "8px",
        borderBottom: !isLast ? "1px solid var(--border)" : "none",
        cursor: isClickable ? "pointer" : "default",
        transition: "background 0.15s ease",
        background: isHovered && isClickable ? "var(--bg-hover)" : "transparent"
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: ".8rem", width: 20, textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
      {g.img_icon_url && !imgError
        ? <img src={g.img_icon_url} alt="" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} onError={() => setImgError(true)} />
        : <div style={{ width: 36, height: 36, borderRadius: 4, background: "var(--border)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">🎮</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: ".9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {g.name}
        </div>
        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--accent-gold)" : "var(--accent)", borderRadius: 2 }} />
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: ".7rem", whiteSpace: "nowrap" }}>
              {g.achievement_count}/{total}
            </span>
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: "var(--accent-gold)", fontWeight: 700, fontSize: ".95rem" }}>{g.playtime_hours}h</div>
        {g.playtime_2weeks_hours > 0 && (
          <div style={{ color: "var(--accent-green)", fontSize: ".7rem" }}>+{g.playtime_2weeks_hours}h {uk ? "нещодавно" : "recent"}</div>
        )}
      </div>
    </div>
  );
}

// Окремий компонент для досягнення
function AchievementRow({ a, steamId, navigate, isSynced, uk }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [gameIconError, setGameIconError] = useState(false);
  const isClickable = a.platform && a.platform_game_id && a.platform_game_id !== "undefined";

  const handleClick = () => {
    if (!isClickable) return;
    
    if (!isSynced) {
      alert(uk 
        ? "🔒 Цей користувач не зареєстрований у NexusStats. Детальна статистика по грі недоступна." 
        : "🔒 This user is not registered in NexusStats. Detailed game stats are unavailable."
      );
      return;
    }

    navigate(`/games/${a.platform}/${a.platform_game_id}?viewer_steam_id=${steamId}`);
  };

  return (
    <div
      role={isClickable ? "button" : "presentation"}
      tabIndex={isClickable ? 0 : -1}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: 8,
        background: "var(--bg-hover)",
        border: `1px solid ${rColor(a.rarity_percent)}22`,
        borderLeft: `3px solid ${rColor(a.rarity_percent)}`,
        cursor: isClickable ? "pointer" : "default",
        transition: "opacity .15s",
        opacity: isHovered && isClickable ? 0.8 : 1
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0, overflow: "hidden", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {a.icon_url && !imgError
          ? <img src={a.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
          : <span style={{ fontSize: "1rem" }} aria-hidden="true">🏆</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: ".88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.display_name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
          {a.game_icon && !gameIconError && (
            <img src={a.game_icon} alt="" style={{ width: 13, height: 13, borderRadius: 2 }} onError={() => setGameIconError(true)} />
          )}
          <span style={{ color: "var(--text-secondary)", fontSize: ".7rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.game_name}
          </span>
        </div>
      </div>
      <span style={{
        background: rBg(a.rarity_percent), color: rColor(a.rarity_percent),
        border: `1px solid ${rColor(a.rarity_percent)}44`,
        borderRadius: 4, padding: "2px 8px", fontSize: ".7rem", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
      }}>
        {a.rarity_percent}%
      </span>
    </div>
  );
}

// Головний компонент
export default function FriendProfile() {
  const { steamId } = useParams();
  const navigate = useNavigate();
  const { language } = useApp();
  const uk = language === "uk";

  const [profile, setProfile] = useState(null);
  const [achList, setAchList] = useState([]);
  const [profLoad, setProfLoad] = useState(true);
  const [achLoad, setAchLoad] = useState(true);
  const [tab, setTab] = useState("games");
  
  
  const [isFavorite, setIsFavorite] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    setProfLoad(true);
    setAchLoad(true);

    Promise.all([
      getPublicProfile(steamId),
      api.get("/profile/bookmarks") 
    ])
      .then(([profRes, favRes]) => {
        const profData = profRes.data;
        const favorites = favRes.data || [];
        
        setProfile(profData);
        setProfLoad(false);
        
        // Перевіряємо чи є цей юзер у списку вибраного
        setIsFavorite(favorites.some(f => f.platform_user_id === steamId));

        if (profData.is_synced) {
          getRareAchievements(50, steamId)
            .then(achRes => setAchList(Array.isArray(achRes.data) ? achRes.data : []))
            .catch(() => setAchList([]))
            .finally(() => setAchLoad(false));
        } else {
          setAchList([]);
          setAchLoad(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setProfLoad(false);
        setAchLoad(false);
      });
  }, [steamId]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await syncProfileData(steamId);
      if (res.data.status === "started") {
        setSyncMsg(uk ? "✅ Синхронізацію запущено! Оновіть сторінку за хвилину." : "✅ Sync started! Refresh in a minute.");
        
        setTimeout(() => {
          getPublicProfile(steamId).then(r => {
            setProfile(r.data);
            if (r.data.is_synced) {
              getRareAchievements(50, steamId)
                .then(ach => setAchList(Array.isArray(ach.data) ? ach.data : []))
                .catch(() => {});
            }
          }).catch(() => { });
        }, 60000);
      } else {
        setSyncMsg(res.data.message || (uk ? "Синхронізацію неможливо запустити." : "Sync unavailable."));
      }
    } catch {
      setSyncMsg(uk ? "❌ Помилка з'єднання" : "❌ Connection error");
    } finally {
      setSyncing(false);
    }
  };

  // ФІКС: Кнопка тепер працює як перемикач
  const handleToggleFavorite = async () => {
    if (!profile) return;
    const newState = !isFavorite;
    
    setIsFavorite(newState); // Оптимістичне оновлення UI
    
    try {
      if (newState) {
        const params = new URLSearchParams({
          platform: "steam",
          platform_user_id: steamId,
          display_name: profile.personaname || "",
          avatar_url: profile.avatar || "",
        });
        await api.post(`/profile/bookmarks?${params.toString()}`);
      } else {
        await api.delete(`/profile/bookmarks/steam/${steamId}`);
      }
    } catch (err) {
      console.error(err);
      setIsFavorite(!newState); // Повертаємо стан у разі помилки
    }
  };

  if (profLoad) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: "2rem" }} aria-hidden="true">👤</div>
      <div style={{ color: "var(--accent)" }}>{uk ? "Завантаження профілю..." : "Loading profile..."}</div>
    </div>
  );

  if (!profile) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--accent-red)" }}>
      {uk ? "Профіль не знайдено" : "Profile not found"}
    </div>
  );

  const stateColors = ["var(--border)", "#4caf50", "#66c0f4", "#f8c63a", "#f8c63a", "#ab47bc", "#ef5350"];
  const stateLabels = uk
    ? ["Офлайн", "Онлайн", "Зайнятий", "Відійшов", "Відійшов", "Не турбувати", "Грає"]
    : ["Offline", "Online", "Busy", "Away", "Away", "Snooze", "In-Game"];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px" }}>
      <button onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginBottom: 20 }}>
        ← {uk ? "Назад" : "Back"}
      </button>

      {/* Header */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {profile.avatar
              ? <img src={profile.avatar} style={{ width: 90, height: 90, borderRadius: 10, display: "block" }} alt="" />
              : <div style={{ width: 90, height: 90, borderRadius: 10, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }} aria-hidden="true">👤</div>
            }
            <div style={{
              position: "absolute", bottom: 4, right: 4, width: 13, height: 13, borderRadius: "50%",
              background: stateColors[profile.personastate ?? 0],
              border: "2px solid var(--bg-card)"
            }} title={stateLabels[profile.personastate ?? 0]} />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ color: "var(--text-bright)", fontSize: "1.6rem", marginBottom: 4 }}>{profile.personaname}</h1>
            <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", marginBottom: 14 }}>Steam ID: {steamId}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={profile.profileurl || `https://steamcommunity.com/profiles/${steamId}`}
                target="_blank" rel="noreferrer"
                className="btn btn-outline" style={{ textDecoration: "none", fontSize: ".85rem" }}>
                Steam ↗
              </a>
              
              {/* ФІКС: Оновлена кнопка з зірочкою */}
              <button
                className={`btn ${isFavorite ? "btn-primary" : "btn-outline"}`}
                onClick={handleToggleFavorite} 
                style={{ fontSize: ".85rem", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {isFavorite 
                  ? <span>⭐ <span style={{ color: "var(--bg-body)" }}>{uk ? "У вибраному" : "Favorited"}</span></span> 
                  : <span>☆ {uk ? "До вибраного" : "Favorite"}</span>}
              </button>
              
              <button
                className="btn btn-outline"
                onClick={handleSync} disabled={syncing}
                style={{ fontSize: ".85rem", borderColor: "var(--accent-green)", color: "var(--accent-green)" }}>
                {syncing ? "⏳" : "🔄"} {uk ? "Завантажити ігри" : "Load Games"}
              </button>
            </div>
            {syncMsg && <div style={{ marginTop: 10, color: "var(--accent-green)", fontSize: ".85rem" }}>{syncMsg}</div>}
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { icon: "🎮", label: uk ? "Ігор" : "Games", value: profile.total_games ?? 0 },
              { icon: "⏱️", label: uk ? "Годин" : "Hours", value: profile.total_hours != null ? `${profile.total_hours}h` : "—" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem" }} aria-hidden="true">{s.icon}</div>
                <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: "1.2rem" }}>{s.value}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: ".73rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[
          { key: "games", label: `🎮 ${uk ? "Ігри" : "Games"}` },
          { key: "achievements", label: `🏆 ${uk ? "Досягнення" : "Achievements"}${achList.length > 0 ? ` (${achList.length})` : ""}` },
        ].map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-outline"}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Games */}
      {tab === "games" && (
        <div className="card" style={{ padding: 24 }}>
          {(profile.top_games || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              {uk ? "Натисніть «Завантажити ігри» щоб побачити статистику" : "Click «Load Games» to see stats"}
            </div>
          ) : (profile.top_games || []).map((g, i) => (
            <GameRow 
              key={g.platform_game_id || i} 
              g={g} 
              i={i} 
              isLast={i === (profile.top_games || []).length - 1} 
              steamId={steamId} 
              uk={uk} 
              navigate={navigate} 
              isSynced={profile.is_synced} 
            />
          ))}
        </div>
      )}

      {/* Achievements */}
      {tab === "achievements" && (
        <div className="card" style={{ padding: 24 }}>
          {achLoad ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--accent)" }}>
              {uk ? "Завантаження досягнень..." : "Loading achievements..."}
            </div>
          ) : achList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }} aria-hidden="true">🏆</div>
              <div style={{ color: "var(--text-secondary)" }}>
                {profile.is_synced
                  ? (uk ? "Досягнень не знайдено" : "No achievements found")
                  : (uk ? "Натисніть «Завантажити ігри» щоб побачити досягнення" : "Click «Load Games» to see achievements")}
              </div>
            </div>
          ) : (
            <>
              <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", marginBottom: 16 }}>
                {achList.length} {uk ? "рідкісних досягнень" : "rare achievements"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {achList.map((a, i) => (
                  <AchievementRow 
                    key={`${a.id}-${i}`} 
                    a={a} 
                    steamId={steamId} 
                    navigate={navigate} 
                    isSynced={profile.is_synced} 
                    uk={uk}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}