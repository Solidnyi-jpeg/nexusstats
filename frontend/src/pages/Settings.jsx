import { useState, useEffect } from "react";
import { useApp } from "../store";
// Зверни увагу: ми додали getConnections та disconnectPlatform
import { connectPlaystation, getConnections, disconnectPlatform } from "../api";

export default function Settings() {
  const { theme, toggleTheme, language, changeLanguage } = useApp();
  const uk = language === "uk";
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); // Для блокування кнопок під час відключення
  const [connections, setConnections] = useState([]); // Стейт для збереження підключених платформ
  
  const [psnId, setPsnId] = useState("");
  const [connectingPsn, setConnectingPsn] = useState(false);

  // Завантажуємо список підключених платформ при відкритті сторінки
  const fetchConnections = () => {
    setLoading(true);
    getConnections()
      .then(res => {
        setConnections(res.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Отримуємо і дані аналітики, і список реальних підключень
      const [overviewRes, connRes] = await Promise.all([
        getOverview().catch(() => ({ data: null })),
        getConnections().catch(() => ({ data: [] }))
      ]);
      
      const connections = connRes.data || [];

      // ЯКЩО ПІДКЛЮЧЕНЬ НЕМАЄ — ВИКИДАЄМО НА WELCOME
      if (connections.length === 0) {
        localStorage.removeItem("token");
        localStorage.removeItem("access_token");
        window.location.replace("/welcome");
        return;
      }

      setData(overviewRes.data);
      setConnections(connections);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Допоміжна функція для пошуку конкретної платформи у списку
  const getConn = (platformName) => connections.find(c => c.platform === platformName);

  const steamConn = getConn("steam");
  const wgConn = getConn("wargaming");
  const psnConn = getConn("playstation");

  // Функція для відключення платформи
  const handleDisconnect = async (platformName) => {
    const confirmMsg = uk ? `Ви впевнені, що хочете відключити ${platformName}?` : `Are you sure you want to disconnect ${platformName}?`;
    if (!window.confirm(confirmMsg)) return;

    setProcessing(true);
    try {
      await disconnectPlatform(platformName);
      fetchConnections(); // Оновлюємо список після видалення
    } catch (err) {
      console.error(err);
      alert(uk ? "Помилка відключення" : "Error disconnecting");
    } finally {
      setProcessing(false);
    }
  };

  const handleConnectPsn = async () => {
    if (!psnId.trim()) return;
    setConnectingPsn(true);
    try {
      await connectPlaystation({ psn_id: psnId.trim() });
      setPsnId("");
      fetchConnections(); // Оновлюємо список без перезавантаження сторінки!
    } catch (err) {
      console.error(err);
    } finally {
      setConnectingPsn(false);
    }
  };

  const linkWargaming = () => {
    const appId = "7f718cf85a9ad6397aa4c32459518d41"; 
    const redirect = encodeURIComponent(`${window.location.origin}/wg-callback`);
    window.location.href = `https://api.worldoftanks.eu/wot/auth/login/?application_id=${appId}&redirect_uri=${redirect}`;
  };

  if (loading) return (
    <div className="loading-screen" style={{ height: "calc(100vh - 60px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <div className="cube-wrapper">
        <div className="cube-3d">
          <div className="cube-face front"></div>
          <div className="cube-face back"></div>
          <div className="cube-face right"></div>
          <div className="cube-face left"></div>
          <div className="cube-face top"></div>
          <div className="cube-face bottom"></div>
        </div>
      </div>
      <div className="loading-text" style={{ textAlign: "center", marginTop: 24, color: "var(--text-bright)" }}>
        {uk ? "Завантаження налаштувань..." : "Loading settings..."}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", fontSize: "2rem", marginBottom: 32 }}>
        {uk ? "Налаштування" : "Settings"}
      </h1>

      {/* --- БЛОК 1: Загальні налаштування --- */}
      <div className="card" style={{ padding: 32, marginBottom: 32 }}>
        <h2 style={{ color: "var(--text-bright)", fontSize: "1.2rem", marginBottom: 24 }}>
          {uk ? "Загальні" : "General"}
        </h2>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ color: "var(--text-bright)", fontWeight: 500 }}>{uk ? "Мова інтерфейсу" : "Language"}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{uk ? "Оберіть мову додатку" : "Choose application language"}</div>
          </div>
          <button className="btn btn-outline" onClick={() => changeLanguage(uk ? "en" : "uk")} disabled={processing}>
            {uk ? "🇬🇧 English" : "🇺🇦 Українська"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--text-bright)", fontWeight: 500 }}>{uk ? "Тема" : "Theme"}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{uk ? "Світла або темна тема" : "Light or dark mode"}</div>
          </div>
          <button className="btn btn-outline" onClick={toggleTheme} disabled={processing}>
            {theme === "dark" ? "☀️ Світла (Light)" : "🌙 Темна (Dark)"}
          </button>
        </div>
      </div>

      {/* --- БЛОК 2: Управління платформами --- */}
      <div className="card" style={{ padding: 32 }}>
        <h2 style={{ color: "var(--text-bright)", fontSize: "1.2rem", marginBottom: 24 }}>
          {uk ? "Підключені платформи" : "Connected Platforms"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Steam */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: steamConn ? "1px solid var(--accent-green)" : "1px solid var(--border)", borderRadius: 8, background: "rgba(23, 26, 33, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: "2rem" }}>🎮</div>
              <div>
                <div style={{ color: "var(--text-bright)", fontWeight: 600 }}>Steam</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {steamConn ? (uk ? `Підключено: ${steamConn.platform_username}` : `Connected: ${steamConn.platform_username}`) : (uk ? "Не підключено" : "Not connected")}
                </div>
              </div>
            </div>
            {steamConn ? (
               <button className="btn btn-outline" onClick={() => handleDisconnect("steam")} disabled={processing} style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)", padding: "8px 16px" }}>
                 {uk ? "Відключити" : "Disconnect"}
               </button>
            ) : (
               <button className="btn btn-primary" onClick={() => window.location.href = "http://localhost:8000/api/v1/auth/steam/login"} disabled={processing} style={{ background: "#171a21", borderColor: "#171a21" }}>
                 {uk ? "Синхронізувати" : "Sync"}
               </button>
            )}
          </div>

          {/* Wargaming */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: wgConn ? "1px solid var(--accent-green)" : "1px solid var(--border)", borderRadius: 8, background: "rgba(255, 77, 0, 0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: "2rem" }}>🛡️</div>
              <div>
                <div style={{ color: "var(--text-bright)", fontWeight: 600 }}>Wargaming</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {wgConn ? (uk ? `Підключено: ${wgConn.platform_username}` : `Connected: ${wgConn.platform_username}`) : "World of Tanks, World of Warships"}
                </div>
              </div>
            </div>
            {wgConn ? (
               <button className="btn btn-outline" onClick={() => handleDisconnect("wargaming")} disabled={processing} style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)", padding: "8px 16px" }}>
                 {uk ? "Відключити" : "Disconnect"}
               </button>
            ) : (
               <button className="btn btn-outline" onClick={linkWargaming} disabled={processing} style={{ borderColor: "#FF4D00", color: "#FF4D00" }}>
                 {uk ? "Додати акаунт" : "Add Account"}
               </button>
            )}
          </div>

          {/* PSN */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: psnConn ? "1px solid var(--accent-green)" : "1px solid var(--border)", borderRadius: 8, background: "rgba(0, 55, 145, 0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: "2rem" }}>🔵</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "var(--text-bright)", fontWeight: 600 }}>PlayStation Network</div>
                
                {psnConn ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4 }}>
                    {uk ? `Підключено: ${psnConn.platform_username}` : `Connected: ${psnConn.platform_username}`}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input 
                      type="text" 
                      placeholder={uk ? "Введіть PSN ID..." : "Enter PSN ID..."} 
                      value={psnId}
                      onChange={(e) => setPsnId(e.target.value)}
                      disabled={processing || connectingPsn}
                      style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-bright)", flex: 1 }}
                    />
                    <button className="btn btn-outline" onClick={handleConnectPsn} disabled={processing || connectingPsn} style={{ borderColor: "#003791", color: "#003791" }}>
                      {connectingPsn ? "⏳" : (uk ? "Зберегти" : "Save")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {psnConn && (
               <button className="btn btn-outline" onClick={() => handleDisconnect("playstation")} disabled={processing} style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)", padding: "8px 16px" }}>
                 {uk ? "Відключити" : "Disconnect"}
               </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}