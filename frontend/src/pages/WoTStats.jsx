import { useState, useEffect } from "react";
import { useApp } from "../store";
import { getWgStats } from "../api";

export default function WoTStats() {
  const { language } = useApp();
  const uk = language === "uk";
  
  const [wgData, setWgData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWgStats()
      .then((res) => {
        setWgData(res.data);
      })
      .catch((err) => console.error("Помилка завантаження WoT:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-screen" style={{ height: "80vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div className="cube-wrapper"><div className="cube-3d"><div className="cube-face front"></div><div className="cube-face back"></div><div className="cube-face right"></div><div className="cube-face left"></div><div className="cube-face top"></div><div className="cube-face bottom"></div></div></div>
    </div>
  );

  // РОЗУМНА ОБРОБКА ПОМИЛОК
  if (!wgData || !wgData.has_data) {
    let errorMsg = uk ? "Синхронізуйте свій акаунт Wargaming у налаштуваннях." : "Sync your Wargaming account in settings.";
    let subMsg = "";

    if (wgData?.error === "hidden_or_no_pc_stats") {
      errorMsg = uk ? "Профіль прихований або не містить боїв на ПК." : "Profile hidden or no PC battles found.";
      subMsg = uk ? "Переконайтеся, що ви не приховали статистику в кабінеті Wargaming, і що це акаунт саме від World of Tanks (не Blitz/Warships)." : "Ensure your profile is public and you play PC Tanks, not Blitz.";
    } else if (wgData?.error === "zero_battles") {
      errorMsg = uk ? "На цьому акаунті 0 боїв у випадкових боях." : "This account has 0 random battles.";
    } else if (wgData?.error === "api_failed") {
      errorMsg = uk ? "Помилка зв'язку з серверами Wargaming." : "Failed to connect to Wargaming servers.";
    }

    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: "5rem", marginBottom: 16 }}>🛡️</div>
        <h2 style={{ color: "var(--text-bright)", marginBottom: 16, fontSize: "1.8rem" }}>
          {wgData?.nickname ? (uk ? `Дані для ${wgData.nickname} недоступні` : `Data unavailable for ${wgData.nickname}`) : (uk ? "Немає даних World of Tanks" : "No World of Tanks Data")}
        </h2>
        <p style={{ color: "var(--accent-gold)", fontSize: "1.1rem", marginBottom: 8, fontWeight: 500 }}>{errorMsg}</p>
        {subMsg && <p style={{ color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.5 }}>{subMsg}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
      <div className="card" style={{ padding: 32, border: "2px solid rgba(255, 77, 0, 0.5)", background: "linear-gradient(135deg, rgba(255, 77, 0, 0.08) 0%, transparent 100%)", marginBottom: 32, display: "flex", alignItems: "center", gap: 24 }}>
        <img src="https://eu-wotp.wgcdn.co/dcont/fb/image/wot_logo_1.png" alt="WoT" style={{ height: 80, filter: "drop-shadow(0 0 10px rgba(255,77,0,0.3))" }} />
        <div>
          <h1 style={{ color: "var(--text-bright)", margin: "0 0 8px 0", fontSize: "2rem" }}>World of Tanks</h1>
          <div style={{ color: "var(--accent-gold)", fontSize: "1.2rem", fontWeight: 600 }}>{wgData.nickname}</div>
        </div>
      </div>

      <h2 style={{ color: "var(--text-bright)", fontSize: "1.2rem", marginBottom: 20 }}>{uk ? "Загальна бойова ефективність" : "Overall Combat Efficiency"}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 8 }}>{uk ? "Всього боїв" : "Total Battles"}</div>
          <div style={{ color: "var(--text-bright)", fontSize: "2.5rem", fontWeight: 700 }}>{wgData.battles.toLocaleString()}</div>
        </div>
        
        <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 8 }}>{uk ? "Відсоток перемог" : "Winrate"}</div>
          <div style={{ color: wgData.winrate >= 50 ? "var(--accent-green)" : "var(--accent-red)", fontSize: "2.5rem", fontWeight: 700 }}>{wgData.winrate}%</div>
        </div>

        <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 8 }}>{uk ? "Знищено техніки" : "Tanks Destroyed"}</div>
          <div style={{ color: "var(--accent)", fontSize: "2.5rem", fontWeight: 700 }}>{wgData.frags.toLocaleString()}</div>
        </div>

        <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 8 }}>{uk ? "Виживання" : "Survival Rate"}</div>
          <div style={{ color: "var(--accent-purple)", fontSize: "2.5rem", fontWeight: 700 }}>{wgData.survival_rate}%</div>
        </div>
      </div>
    </div>
  );
}