import { useState, useEffect } from "react";
import { getCsStats } from "../api";
import { useApp } from "../store";

// Еталонний пул карт змагального сезону для синхронізації та заповнення пропусків
const OFFICIAL_MAP_POOL = [
  { id: "de_mirage", name: "Mirage" },
  { id: "de_inferno", name: "Inferno" },
  { id: "de_dust2", name: "Dust II" },
  { id: "de_nuke", name: "Nuke" },
  { id: "de_vertigo", name: "Vertigo" },
  { id: "de_ancient", name: "Ancient" },
  { id: "de_anubis", name: "Anubis" },
  { id: "de_overpass", name: "Overpass" },
  { id: "cs_office", name: "Office" }
];

export default function CsStats() {
  const { language } = useApp();
  const uk = language === "uk";
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getCsStats()
      .then(res => { if (res?.data) setStats(res.data); })
      .catch(err => {
        setError(err.response?.data?.detail || (uk ? "Не вдалося завантажити статистику CS." : "Failed to load CS stats."));
      })
      .finally(() => setLoading(false));
  }, [uk]);

  if (loading) return <div style={{ textAlign: "center", padding: "100px", color: "var(--text-secondary)" }}>{uk ? "Завантаження бойової телеметрії..." : "Loading telemetry..."}</div>;
  if (error) return <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }} className="card"><p style={{ color: "var(--accent-red)", padding: 20 }}>{error}</p></div>;
  if (!stats) return null;

  const { overall, maps: backendMaps, weapons } = stats;

  // Інтелектуальне з'єднання (Left Join): доповнюємо пропущені карти з нульовою активністю
  const finalMapPool = OFFICIAL_MAP_POOL.map(poolMap => {
    // Шукаємо карту у відповіді бекенду за повним збігом або без префікса "de_" / "cs_"
    const userMap = backendMaps.find(m => 
      m.id === poolMap.id || 
      m.id === poolMap.id.replace(/^de_|^cs_/, "")
    );

    if (userMap) {
      return {
        ...userMap,
        // Виправляємо назву на канонічну, якщо бекенд повернув сирий або некрасивий токен
        name: userMap.name === "Dust2" ? "Dust II" : userMap.name,
        hasMatches: userMap.matches > 0
      };
    }

    // Якщо карти немає в телеметрії користувача, створюємо пустий об'єкт для візуалізації "зони ігнорування"
    return {
      id: poolMap.id,
      name: poolMap.name,
      matches: 0,
      winrate: 0,
      hasMatches: false
    };
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
      
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <img src="https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg" alt="CS2" style={{ width: 110, borderRadius: 6 }} />
        <div>
          <h1 style={{ color: "var(--text-bright)", fontSize: "1.6rem", margin: 0 }}>CS2 Analytics</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: ".85rem", marginTop: 4 }}>Lifetime Steam Telemetry</div>
        </div>
      </div>

      {/* Головна статистика */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>K/D RATIO</div>
          <div style={{ color: overall.kd >= 1 ? "var(--accent-green)" : "var(--accent-red)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.kd}</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>HEADSHOTS</div>
          <div style={{ color: "var(--accent-gold)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.hs_percent}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "ВІНРЕЙТ" : "WINRATE"}</div>
          <div style={{ color: overall.winrate >= 50 ? "var(--accent-green)" : "var(--accent)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.winrate}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "МАТЧІВ ЗІГРАНО" : "MATCHES PLAYED"}</div>
          <div style={{ color: "var(--text-bright)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.matches}</div>
        </div>
      </div>

      {/* Аналітика Карт */}
      <h2 style={{ color: "var(--text-bright)", fontSize: "1.1rem", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <span>🗺️</span> {uk ? "Ефективність на картах" : "Map Efficiency"}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 32 }}>
        {finalMapPool.map(m => (
          <div key={m.id} style={{ 
            position: "relative", height: 110, borderRadius: 8, overflow: "hidden", 
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", justifyContent: "flex-end",
            border: m.hasMatches ? "1px solid rgba(255,255,255,0.05)" : "1px dashed rgba(255,255,255,0.12)",
            opacity: m.hasMatches ? 1 : 0.55,
            transition: "all 0.2s ease"
          }}>
            {/* Офіційний бекграунд карти від Valve */}
            <div style={{ 
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1,
              backgroundImage: `url(https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/maps/bg_${m.id}.png)`,
              backgroundSize: "cover", backgroundPosition: "center", filter: "brightness(0.5) contrast(1.1)"
            }} />
            
            {/* Контрастна градієнтна підкладка для тексту, щоб назва чітко відрізнялася від картинки */}
            <div style={{ 
              position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "14px 16px",
              background: "linear-gradient(to top, rgba(10, 10, 14, 0.95) 0%, rgba(10, 10, 14, 0.7) 65%, rgba(10, 10, 14, 0) 100%)",
              width: "100%", boxSizing: "border-box"
            }}>
              <div>
                <div style={{ color: "var(--text-bright)", fontSize: "1.15rem", fontWeight: 800, letterSpacing: 0.5 }}>
                  {m.name}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600, marginTop: 2 }}>
                  {m.hasMatches ? `~${m.matches} ${uk ? "матчів" : "matches"}` : (uk ? "Немає матчів" : "No matches")}
                </div>             
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ 
                  color: !m.hasMatches ? "var(--text-secondary)" : (m.winrate >= 50 ? "var(--accent-green)" : "var(--accent-red)"), 
                  fontSize: "1.35rem", fontWeight: 800 
                }}>
                  {m.winrate}%
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: 1 }}>
                  {uk ? "ВІНРЕЙТ" : "WINRATE"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ----------------- АРСЕНАЛ (ЗБРОЯ) ----------------- */}
      <div className="card" style={{ padding: "24px 0" }}>
        <h2 style={{ color: "var(--text-bright)", fontSize: "1.1rem", marginBottom: 20, padding: "0 24px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔫</span> {uk ? "Улюблений арсенал" : "Top Arsenal"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "0 24px 12px", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1, borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
          <div>{uk ? "ЗБРОЯ" : "WEAPON"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ВБИВСТВА" : "KILLS"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ВЛУЧАННЯ / ПОСТРІЛИ" : "HITS / SHOTS"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ТОЧНІСТЬ" : "ACCURACY"}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {weapons.map((w) => (
            <div key={w.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.03)", background: "transparent", transition: "background 0.2s ease" }}
                 onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                 onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ color: "var(--text-bright)", fontWeight: 800, fontSize: "1rem", letterSpacing: 0.5 }}>
                {w.name}
              </div>
              
              <div style={{ textAlign: "center", color: "var(--text-bright)", fontWeight: 700, fontSize: "1rem" }}>
                {w.kills.toLocaleString()}
              </div>
              
              <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                <span style={{ color: "var(--accent)" }}>{w.hits.toLocaleString()}</span> / {w.shots.toLocaleString()}
              </div>
              
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ color: w.accuracy > 25 ? "var(--accent-green)" : "var(--accent-gold)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {w.accuracy}%
                </span>
                <div style={{ width: 60, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: `${w.accuracy}%`, height: "100%", background: w.accuracy > 25 ? "var(--accent-green)" : "var(--accent-gold)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}