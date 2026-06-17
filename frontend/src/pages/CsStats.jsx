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
  if (error) return <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }} className="card"><p style={{ color: "var(--accent-red)", padding: 20 }}>{error}</p></div>;
  if (!stats) return null;

  const { overall, maps: backendMaps, weapons } = stats;

  // Інтелектуальне об'єднання даних (Dynamic Map Pool Resolver)
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
          <h1 style={{ color: "var(--text-bright, #111827)", fontSize: "1.6rem", recruitment: "700", margin: 0 }}>CS2 Analytics</h1>
          <div style={{ color: "var(--text-secondary, #6b7280)", fontSize: ".85rem", marginTop: 4 }}>Lifetime Steam Telemetry</div>
        </div>
      </div>

      {/* Головна статистика */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ padding: 20, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary, #6b7280)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>K/D RATIO</div>
          <div style={{ color: overall.kd >= 1 ? "#10b981" : "#ef4444", fontSize: "1.8rem", fontWeight: 800 }}>{overall.kd}</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary, #6b7280)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>HEADSHOTS</div>
          <div style={{ color: "#f59e0b", fontSize: "1.8rem", fontWeight: 800 }}>{overall.hs_percent}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary, #6b7280)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "ВІНРЕЙТ" : "WINRATE"}</div>
          <div style={{ color: overall.winrate >= 50 ? "#10b981" : "#3b82f6", fontSize: "1.8rem", fontWeight: 800 }}>{overall.winrate}%</div>
        </div>
        <div className="card" style={{ padding: 20, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary, #6b7280)", fontSize: ".8rem", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{uk ? "МАТЧІВ ЗІГРАНО" : "MATCHES PLAYED"}</div>
          <div style={{ color: "var(--text-bright, #111827)", fontSize: "1.8rem", fontWeight: 800 }}>{overall.matches}</div>
        </div>
      </div>

      {/* Аналітика Карт */}
      <h2 style={{ color: "var(--text-bright, #111827)", fontSize: "1.2rem", fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <span>🗺️</span> {uk ? "Ефективність на картах" : "Map Efficiency"}
      </h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 40 }}>
        {finalMapPool.map(m => (
          <div key={m.id} style={{ 
            background: m.hasMatches ? "#ffffff" : "#f9fafb", 
            borderRadius: 12, 
            padding: "20px 24px",
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            border: m.hasMatches ? "1px solid #e5e7eb" : "1px dashed #d1d5db",
            boxShadow: m.hasMatches ? "0 4px 12px rgba(0,0,0,0.03)" : "none",
            opacity: m.hasMatches ? 1 : 0.6,
            transition: "all 0.2s ease"
          }}>
            <div>
              <div style={{ color: m.hasMatches ? "#111827" : "#4b5563", fontSize: "1.2rem", fontWeight: 700, letterSpacing: -0.3 }}>
                {m.name}
              </div>
              <div style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: 4, fontWeight: 500 }}>
                {m.hasMatches ? `~${m.matches} ${uk ? "матчів" : "matches"}` : (uk ? "Немає матчів" : "No matches")}
              </div>             
            </div>
            
            <div style={{ textAlign: "right" }}>
              <div style={{ 
                color: !m.hasMatches ? "#9ca3af" : (m.winrate >= 50 ? "#10b981" : "#ef4444"), 
                fontSize: "1.5rem", 
                fontWeight: 800 
              }}>
                {m.hasMatches ? `${m.winrate}%` : "—"}
              </div>
              <div style={{ color: "#9ca3af", fontSize: "0.65rem", fontWeight: 700, letterSpacing: 0.5, marginTop: 2 }}>
                {uk ? "ВІНРЕЙТ" : "WINRATE"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Арсенал зброї */}
      <div className="card" style={{ padding: "24px 0", background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <h2 style={{ color: "var(--text-bright, #111827)", fontSize: "1.1rem", marginBottom: 20, padding: "0 24px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔫</span> {uk ? "Улюблений арсенал" : "Top Arsenal"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "0 24px 12px", color: "#6b7280", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1, borderBottom: "1px solid #f3f4f6", marginBottom: 8 }}>
          <div>{uk ? "ЗБРОЯ" : "WEAPON"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ВБИВСТВА" : "KILLS"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ВЛУЧАННЯ / ПОСТРІЛИ" : "HITS / SHOTS"}</div>
          <div style={{ textAlign: "center" }}>{uk ? "ТОЧНІСТЬ" : "ACCURACY"}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {weapons.map((w) => (
            <div key={w.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid #f9fafb", background: "transparent", transition: "background 0.2s ease" }}
                 onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                 onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ color: "#111827", fontWeight: 700, fontSize: "0.95rem" }}>
                {w.name}
              </div>
              
              <div style={{ textAlign: "center", color: "#111827", fontWeight: 700 }}>
                {w.kills.toLocaleString()}
              </div>
              
              <div style={{ textAlign: "center", fontSize: "0.85rem", color: "#4b5563", fontFamily: "monospace" }}>
                <span style={{ color: "#3b82f6", fontWeight: 600 }}>{w.hits.toLocaleString()}</span> / {w.shots.toLocaleString()}
              </div>
              
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ color: w.accuracy > 25 ? "#10b981" : "#f59e0b", fontWeight: 700, fontSize: "0.95rem" }}>
                  {w.accuracy}%
                </span>
                <div style={{ width: 60, height: 4, background: "#e5e7eb", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: `${w.accuracy}%`, height: "100%", background: w.accuracy > 25 ? "#10b981" : "#f59e0b" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}