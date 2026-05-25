import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import axios from "axios";

export default function Settings() {
  const { t } = useTranslation();
  const { theme, toggleTheme, language, changeLanguage } = useApp();
  const [steamId, setSteamId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showLogout, setShowLogout] = useState(false);
  const isUk = language === "uk";

  const handleSetup = async () => {
    if (!steamId.trim()) return;
    try {
      await axios.post(`http://localhost:8000/debug/setup?steam_id=${steamId.trim()}`);
      setSyncResult({ type: "success", message: isUk ? "Steam підключено!" : "Steam connected!" });
    } catch {
      setSyncResult({ type: "error", message: isUk ? "Помилка підключення" : "Failed to connect" });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await axios.post("http://localhost:8000/debug/sync");
      setSyncResult({
        type: "success",
        message: isUk
          ? `Синхронізовано: ${res.data.synced_games} ігор, ${res.data.synced_achievements} досягнень`
          : `Synced: ${res.data.synced_games} games, ${res.data.synced_achievements} achievements`,
      });
    } catch {
      setSyncResult({ type: "error", message: isUk ? "Помилка синхронізації" : "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:8000/debug/clear");
      localStorage.removeItem("nexusstats_setup_done");
      window.location.href = "/";
    } catch {
      setSyncResult({ type: "error", message: isUk ? "Помилка виходу" : "Logout failed" });
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", marginBottom: "24px", fontSize: "1.5rem" }}>
        ⚙️ {t("settings.title")}
      </h1>

      {/* Appearance */}
      <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
        <h3 style={{ color: "var(--text-bright)", marginBottom: "20px" }}>
          🎨 {t("settings.appearance")}
        </h3>
        <div style={{ display: "flex", gap: "24px", alignItems: "center", marginBottom: "20px" }}>
          <span style={{ color: "var(--text-secondary)", width: "120px" }}>{t("settings.language")}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {[{ code: "uk", label: "🇺🇦 Українська" }, { code: "en", label: "🇬🇧 English" }].map(l => (
              <button key={l.code}
                className={`btn ${language === l.code ? "btn-primary" : "btn-outline"}`}
                onClick={() => changeLanguage(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <span style={{ color: "var(--text-secondary)", width: "120px" }}>{t("settings.theme")}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className={`btn ${theme === "dark" ? "btn-primary" : "btn-outline"}`}
              onClick={() => theme !== "dark" && toggleTheme()}>
              🌙 {t("settings.dark")}
            </button>
            <button className={`btn ${theme === "light" ? "btn-primary" : "btn-outline"}`}
              onClick={() => theme !== "light" && toggleTheme()}>
              ☀️ {t("settings.light")}
            </button>
          </div>
        </div>
      </div>

      {/* Steam */}
      <div className="card" style={{ padding: "24px", marginBottom: "16px" }}>
        <h3 style={{ color: "var(--text-bright)", marginBottom: "20px" }}>
          🎮 {t("settings.platforms")}
        </h3>
        <div style={{ background: "var(--bg-hover)", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "6px" }}>
            {t("settings.howToFind")}:
          </div>
          <div style={{ color: "var(--text-primary)", fontSize: "0.82rem", lineHeight: 1.8 }}>
            1. {t("settings.howToFind1")} —{" "}
            <a href="https://steamid.io" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>steamid.io</a><br />
            2. {t("settings.howToFind2")}<br />
            3. {t("settings.howToFind3")}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <input value={steamId} onChange={e => setSteamId(e.target.value)}
            placeholder="76561198XXXXXXXXX"
            style={{
              flex: 1, padding: "10px 14px",
              background: "var(--bg-primary)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", color: "var(--text-primary)", outline: "none",
            }} />
          <button className="btn btn-primary" onClick={handleSetup} disabled={!steamId.trim()}>
            {t("settings.connectSteam")}
          </button>
        </div>
        <button className="btn btn-outline" onClick={handleSync} disabled={syncing}>
          {syncing ? t("settings.syncing") : `🔄 ${t("settings.sync")}`}
        </button>

        {syncResult && (
          <div style={{
            marginTop: "16px", padding: "12px 16px", borderRadius: "6px",
            background: syncResult.type === "success" ? "#4caf5022" : "#ef535022",
            border: `1px solid ${syncResult.type === "success" ? "#4caf5044" : "#ef535044"}`,
            color: syncResult.type === "success" ? "var(--accent-green)" : "var(--accent-red)",
          }}>
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Account */}
      <div className="card" style={{ padding: "24px" }}>
        <h3 style={{ color: "var(--text-bright)", marginBottom: "16px" }}>
          👤 {isUk ? "Акаунт" : "Account"}
        </h3>

        {!showLogout ? (
          <button
            className="btn btn-outline"
            style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
            onClick={() => setShowLogout(true)}>
            🚪 {isUk ? "Вийти з акаунту" : "Sign Out"}
          </button>
        ) : (
          <div style={{
            background: "#ef535011", border: "1px solid #ef535044",
            borderRadius: "8px", padding: "20px",
          }}>
            <div style={{ color: "var(--text-bright)", marginBottom: "8px", fontWeight: "600" }}>
              {isUk ? "Ви впевнені?" : "Are you sure?"}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "16px" }}>
              {isUk
                ? "Всі дані буде видалено. Ви зможете підключити інший акаунт після виходу."
                : "All data will be cleared. You can connect a different account after signing out."
              }
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn btn-outline"
                style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
                onClick={handleLogout}>
                {isUk ? "Так, вийти" : "Yes, sign out"}
              </button>
              <button className="btn btn-outline" onClick={() => setShowLogout(false)}>
                {isUk ? "Скасувати" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
