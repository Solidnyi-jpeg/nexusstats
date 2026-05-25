import { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

const STEPS = ["welcome", "connect", "sync", "done"];

export default function Welcome({ onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [steamId, setSteamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    if (!steamId.trim()) return;
    setLoading(true);
    setError("");
    try {
      await axios.post(`http://localhost:8000/debug/setup?steam_id=${steamId.trim()}`);
      setStep(2);
    } catch {
      setError(t("welcome.errorConnect"));
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post("http://localhost:8000/debug/sync");
      setStep(3);
    } catch {
      setError(t("welcome.errorSync"));
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: "🎮", title: t("welcome.feature1Title"), desc: t("welcome.feature1Desc") },
    { icon: "📊", title: t("welcome.feature2Title"), desc: t("welcome.feature2Desc") },
    { icon: "🏆", title: t("welcome.feature3Title"), desc: t("welcome.feature3Desc") },
    { icon: "👥", title: t("welcome.feature4Title"), desc: t("welcome.feature4Desc") },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-primary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ maxWidth: "620px", width: "100%" }}>

        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎮</div>
            <h1 style={{ color: "var(--accent)", fontSize: "2.5rem", fontWeight: "bold", letterSpacing: "0.1em", marginBottom: "8px" }}>
              NEXUSSTATS
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: "40px" }}>
              {t("welcome.subtitle")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "40px" }}>
              {features.map(f => (
                <div key={f.title} className="card" style={{ padding: "20px", textAlign: "left" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>{f.icon}</div>
                  <div style={{ color: "var(--text-bright)", fontWeight: "600", marginBottom: "4px" }}>{f.title}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ fontSize: "1.1rem", padding: "14px 48px" }}
              onClick={() => setStep(1)}>
              {t("welcome.getStarted")}
            </button>
            <div style={{ marginTop: "16px" }}>
              <button style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.9rem" }}
                onClick={onComplete}>
                {t("welcome.skip")}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", marginBottom: "24px", fontSize: "0.9rem" }}>
              {t("welcome.back")}
            </button>
            <div className="card" style={{ padding: "40px" }}>
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎮</div>
                <h2 style={{ color: "var(--text-bright)", fontSize: "1.5rem" }}>{t("welcome.connectSteam")}</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>{t("welcome.connectDesc")}</p>
              </div>
              <div style={{ background: "var(--bg-hover)", borderRadius: "8px", padding: "16px", marginBottom: "24px" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "8px" }}>
                  {t("welcome.howToFind")}:
                </div>
                <div style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>
                  1. {t("welcome.howToFind1")} — <a href="https://steamid.io" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>steamid.io</a><br/>
                  2. {t("welcome.howToFind2")}<br/>
                  3. {t("welcome.howToFind3")}
                </div>
              </div>
              <input value={steamId} onChange={e => setSteamId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleConnect()}
                placeholder={t("welcome.steamIdPlaceholder")}
                style={{
                  width: "100%", padding: "12px 16px", marginBottom: "12px",
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", color: "var(--text-primary)",
                  fontSize: "1rem", outline: "none", boxSizing: "border-box",
                }} />
              {error && <div style={{ color: "var(--accent-red)", fontSize: "0.85rem", marginBottom: "12px" }}>⚠️ {error}</div>}
              <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }}
                onClick={handleConnect} disabled={loading || !steamId.trim()}>
                {loading ? t("welcome.connecting") : t("welcome.connectBtn")}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>✅</div>
            <h2 style={{ color: "var(--text-bright)", marginBottom: "8px" }}>{t("welcome.steamConnected")}</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>{t("welcome.importDesc")}</p>
            <div style={{ background: "var(--bg-hover)", borderRadius: "8px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "8px" }}>{t("welcome.willImport")}:</div>
              <div style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>
                🎮 {t("welcome.willImport1")}<br/>
                🏆 {t("welcome.willImport2")}<br/>
                ⏱️ {t("welcome.willImport3")}
              </div>
            </div>
            {error && <div style={{ color: "var(--accent-red)", marginBottom: "12px" }}>⚠️ {error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }}
              onClick={handleSync} disabled={loading}>
              {loading ? t("welcome.importing") : t("welcome.importBtn")}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="card" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ color: "var(--text-bright)", fontSize: "1.5rem", marginBottom: "8px" }}>{t("welcome.doneTitle")}</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>{t("welcome.doneDesc")}</p>
            <button className="btn btn-primary" style={{ fontSize: "1.1rem", padding: "14px 48px" }}
              onClick={onComplete}>
              {t("welcome.openDashboard")}
            </button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "32px" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? "24px" : "8px", height: "8px",
              borderRadius: "4px",
              background: i <= step ? "var(--accent)" : "var(--border)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
