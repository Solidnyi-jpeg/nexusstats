import { useState, useEffect } from "react";
import { getCsStats } from "../api";
import { useApp } from "../store";

// Повний еталонний пул карт сезону для відображення всіх локацій
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
  if (error) return <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }} className="card"><p style={{ color: "var(--accent-red, #ef4444)", padding: 20 }}>{error}</p></div>;
  if (!stats) return null;

  const { overall, maps: backendMaps, weapons } = stats;

  // Інтелектуальне об'єднання даних
  const finalMapPool = OFFICIAL_MAP_POOL.map(poolMap => {
    const userMap = backendMaps.find(m => 
      m.id === poolMap.id || 
      m.id === poolMap.id.replace(/^de_|^cs_/, "")
    );

    if (userMap) {
      return {
        ...userMap,
        name: userMap.name === "Dust2" ? "Dust II" : userMap.name,
        hasMatches: userMap.matches > 0
      };
    }

    return {
      id: poolMap.id,
      name: poolMap.name,
      matches: 0,
      winrate: 0,
      hasMatches: false
    };
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", fontFamily: "system-ui, sans-serif" }}>
      
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <img src="https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg" alt="CS2" style={{ width: 110, borderRadius: 6 }} />
        <div>
          <h1 style={{ color: "var(--text-primary, inherit)", fontSize: "1.6rem", fontWeight: "700", margin: 0 }}>CS2 Analytics</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: ".85rem", marginTop: 4 }}>Lifetime Steam Telemetry</div>
        </div>
      </div>

      {/* Головна статистика */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ padding: 20, textAlign: "center", borderRadius: 12 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>K/D RATIO</div>
          <div style={{ color: overall.kd >= 1 ? "var(--accent-green, #10b981)" : "var(--accent-red, #ef4444)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.kd}</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", borderRadius: 12 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>HEADSHOTS</div>
          <div style={{ color: "var(--accent-yellow, #f59e0b)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.hs_percent}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", borderRadius: 12 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "ВІНРЕЙТ" : "WINRATE"}</div>
          <div style={{ color: overall.winrate >= 50 ? "var(--accent-green, #10b981)" : "var(--accent-blue, #3b82f6)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.winrate}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", borderRadius: 12 }}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "МАТЧІВ ЗІГРАНО" : "MATCHES PLAYED"}</div>
          <div style={{ color: "var(--text-primary, inherit)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.matches}</div>
        </div>
      </div>

      {/* Аналітика Карт */}
      <h2 style={{ color: "var(--text-primary, inherit)", fontSize: "1.2rem", fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <span>🗺️</span> {uk ? "Ефективність на картах" : "Map Efficiency"}
      </h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 40 }}>
        {/* Додано .filter() щоб залишати лише карти з матчами */}
        {finalMapPool.filter(m => m.hasMatches).map(m => (
          <div key={m.id} className="card" style={{ 
            borderRadius: 12, 
            padding: "20px 24px",
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            transition: "all 0.2s ease"
          }}>
            <div>
              <div style={{ color: "var(--text-primary, inherit)", fontSize: "1.2rem", fontWeight: 700, letterSpacing: -0.3 }}>
                {m.name}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4, fontWeight: 500 }}>
                ~{m.matches} {uk ? "матчів" : "matches"}
              </div>             
            </div>
            
            <div style={{ textAlign: "right" }}>
              <div style={{ 
                color: m.winrate >= 50 ? "var(--accent-green, #10b981)" : "var(--accent-red, #ef4444)", 
                fontSize: "1.5rem", 
                fontWeight: 800 
              }}>
                {m.winrate}%
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: 0.5, marginTop: 2 }}>
                {uk ? "ВІНРЕЙТ" : "WINRATE"}
              </div>
            </div>
          </div>
        ))}
        {/* Опціонально: Якщо жодної карти немає, можна показати повідомлення */}
        {finalMapPool.filter(m => m.hasMatches).length === 0 && (
          <div style={{ color: "var(--text-secondary)", padding: "10px 0" }}>
            {uk ? "Ще немає зіграних матчів на цих картах." : "No matches played on these maps yet."}
          </div>
        )}
      </div>

      {/* Арсенал зброї */}
      <div className="card" style={{ padding: "24px 0", borderRadius: 12 }}>
        <h2 style={{ color: "var(--text-primary, inherit)", fontSize: "1.1rem", marginBottom: 20, padding: "0 24px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔫</span> {uk ? "Улюблений арсенал" : "Top Arsenal"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "0 24px 12px", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1, borderBottom: "1px solid var(--border-color, rgba(128,128,128,0.2))", marginBottom: 8 }}>
          <div>{uk ? "ЗБРОЯ" : "WEAPON"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ВБИВСТВА" : "KILLS"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ВЛУЧАННЯ / ПОСТРІЛИ" : "HITS / SHOTS"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ТОЧНІСТЬ" : "ACCURACY"}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {weapons.map((w) => (
            <div key={w.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid var(--border-color, rgba(128,128,128,0.1))", background: "transparent", transition: "background 0.2s ease" }}
                 onMouseEnter={(e) => e.currentTarget.style.background = "var(--hover-bg, rgba(128,128,128,0.05))"}
                 onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ color: "var(--text-primary, inherit)", fontWeight: 700, fontSize: "0.95rem" }}>
                {w.name}
              </div>
              
              <div style={{ textAlign: "center", color: "var(--text-primary, inherit)", fontWeight: 700 }}>
                {w.kills.toLocaleString()}
              </div>
              
              <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                <span style={{ color: "var(--accent-blue, #3b82f6)", fontWeight: 600 }}>{w.hits.toLocaleString()}</span> / {w.shots.toLocaleString()}
              </div>
              
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ color: w.accuracy > 25 ? "var(--accent-green, #10b981)" : "var(--accent-yellow, #f59e0b)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {w.accuracy}%
                </span>
                <div style={{ width: 60, height: 4, background: "var(--border-color, rgba(128,128,128,0.2))", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: `${w.accuracy}%`, height: "100%", background: w.accuracy > 25 ? "var(--accent-green, #10b981)" : "var(--accent-yellow, #f59e0b)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}