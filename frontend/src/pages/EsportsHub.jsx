import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";

export default function EsportsHub() {
  const navigate = useNavigate();
  const { language } = useApp();
  const uk = language === "uk";

  // Стани для ефекту ховеру на картках
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      
      {/* ----------------- ЦЕНТРОВАНИЙ ТЕКСТ-ОБҐРУНТУВАННЯ ----------------- */}
      <div style={{ textAlign: "center", maxWidth: 750, margin: "0 auto 50px auto", lineHeight: "1.6" }}>
        <h1 style={{ color: "var(--text-bright)", fontSize: "2rem", marginBottom: 16, fontWeight: 800 }}>
          {uk ? "Кіберспортивна аналітика" : "Esports Analytics Hub"}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
          {uk 
            ? "Dota 2 та Counter-Strike — це дві масштабні світові дисципліни з мільйонною аудиторією, розвиненою екосистемою турнірів та професійним кіберспортом. Звичайної статистики платформ тут недостатньо. NexusStats надає високоточну персональну аналітику, KDA-метрики, історію матчів та аналіз ігрової ефективності для твоїх змагальних ігор."
            : "Dota 2 and Counter-Strike are two massive global disciplines with millions of players, complex tournament ecosystems, and professional esports networks. Basic platform stats aren't enough here. NexusStats delivers high-precision personal telemetry, KDA tracking, match histories, and in-depth performance analysis for your competitive matches."}
        </p>
      </div>

      {/* ----------------- КАРТКИ ІГОР (DOTA 2 & CS2) ----------------- */}
      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", justifyContent: "center" }}>
        
        {/* Картка DOTA 2 */}
        <div
          role="button"
          tabIndex={0}
          className="card"
          onMouseEnter={() => setHoveredCard("dota")}
          onMouseLeave={() => setHoveredCard(null)}
          onClick={() => navigate("/dota")}
          style={{
            flex: "1 1 450px",
            maxWidth: "500px",
            padding: "24px",
            cursor: "pointer",
            transition: "all 0.25s ease",
            borderColor: hoveredCard === "dota" ? "var(--accent)" : "var(--border)",
            transform: hoveredCard === "dota" ? "translateY(-4px)" : "none",
            boxShadow: hoveredCard === "dota" ? "0 8px 24px rgba(0,0,0,0.2)" : "none"
          }}
        >
          <img 
            src="https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg" 
            alt="Dota 2" 
            style={{ width: "100%", borderRadius: "8px", marginBottom: 16 }}
          />
          <h2 style={{ color: "var(--text-bright)", fontSize: "1.3rem", margin: "0 0 8px 0" }}>Dota 2 Analytics</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0, lineHeight: "1.5" }}>
            {uk 
              ? "Глибокий аналіз профілю: відстеження поточного рангу (медалі), динаміка вінрейту, розширена статистика останніх 20 ігор, показники GPM/XPM та KDA для кожного матчу."
              : "In-depth profile analysis: track your competitive rank tier, win rate dynamics, detailed telemetry for your recent 20 matches, alongside GPM, XPM, and individual KDA performance."}
          </p>
          <div style={{ marginTop: 16, color: "var(--accent)", fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6 }}>
            {uk ? "Відкрити аналітику" : "Open Analytics"} →
          </div>
        </div>

        {/* Картка COUNTER-STRIKE */}
        <div
          role="button"
          tabIndex={0}
          className="card"
          onMouseEnter={() => setHoveredCard("cs")}
          onMouseLeave={() => setHoveredCard(null)}
          onClick={() => navigate("/cs")}
          style={{
            flex: "1 1 450px",
            maxWidth: "500px",
            padding: "24px",
            cursor: "pointer",
            transition: "all 0.25s ease",
            borderColor: hoveredCard === "cs" ? "var(--accent-gold)" : "var(--border)",
            transform: hoveredCard === "cs" ? "translateY(-4px)" : "none",
            boxShadow: hoveredCard === "cs" ? "0 8px 24px rgba(0,0,0,0.2)" : "none"
          }}
        >
          <img 
            src="https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg" 
            alt="CS2" 
            style={{ width: "100%", borderRadius: "8px", marginBottom: 16 }}
          />
          <h2 style={{ color: "var(--text-bright)", fontSize: "1.3rem", margin: "0 0 8px 0" }}>Counter-Strike Analytics</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0, lineHeight: "1.5" }}>
            {uk 
              ? "Офіційна бойова статистика Steam: точний розрахунок довічного K/D Ratio, відсоток влучань у голову (Headshots %), кількість завойованих MVP медалей та загальна кількість перемог."
              : "Official Steam combat telemetry: real-time calculation of your lifetime K/D Ratio, headshot accuracy percentage, total MVP medals earned, and absolute match victories."}
          </p>
          <div style={{ marginTop: 16, color: "var(--accent-gold)", fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6 }}>
            {uk ? "Відкрити аналітику" : "Open Analytics"} →
          </div>
        </div>

      </div>
    </div>
  );
}