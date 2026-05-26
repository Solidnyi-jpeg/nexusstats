import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { searchPlayer } from "../api";

const STATUS_LABELS = {
  uk: ["Офлайн", "Онлайн", "Зайнятий", "Відійшов", "Відійшов", "Не турбувати", "Грає"],
  en: ["Offline", "Online", "Busy", "Away", "Away", "Snooze", "Playing"],
};
const STATUS_COLORS = ["var(--border)", "var(--accent-green)", "#66c0f4", "#f8c63a", "#f8c63a", "#ab47bc", "var(--accent-green)"];

export default function Search() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isUk = i18n.language === "uk";
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await searchPlayer(query.trim());
      if (!res.data.found) {
        setError(res.data.error || t("search.notFound"));
      } else {
        setResult(res.data);
      }
    } catch (e) {
      setError(t("search.notFound"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", marginBottom: "24px", fontSize: "1.5rem" }}>
        🔍 {t("search.title")}
      </h1>

      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={t("search.placeholder")}
          style={{
            flex: 1, padding: "12px 16px",
            background: "var(--bg-card)", border: `1px solid ${error ? "var(--accent-red)" : "var(--border)"}`,
            borderRadius: "var(--radius)", color: "var(--text-primary)",
            fontSize: "1rem", outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = "var(--accent)"}
          onBlur={e => e.target.style.borderColor = error ? "var(--accent-red)" : "var(--border)"}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? "⏳" : "🔍"}
        </button>
      </div>

      <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "24px" }}>
        {isUk ? "Введіть нікнейм Steam (vanity URL) або Steam ID64" : "Enter Steam nickname (vanity URL) or Steam ID64"}
      </div>

      {error && (
        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>😕</div>
          <div style={{ color: "var(--accent-red)" }}>{error}</div>
        </div>
      )}

      {result && (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {result.avatarmedium && (
                <img src={result.avatarmedium} style={{ width: "80px", height: "80px", borderRadius: "8px", display: "block" }} />
              )}
              <div style={{
                position: "absolute", bottom: "3px", right: "3px",
                width: "12px", height: "12px", borderRadius: "50%",
                background: STATUS_COLORS[result.personastate || 0],
                border: "2px solid var(--bg-card)",
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text-bright)", fontSize: "1.3rem", fontWeight: "bold", marginBottom: "4px" }}>
                {result.personaname}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "4px" }}>
                Steam ID: {result.steam_id}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: STATUS_COLORS[result.personastate || 0],
                }} />
                <span style={{ color: STATUS_COLORS[result.personastate || 0], fontSize: "0.8rem" }}>
                  {(STATUS_LABELS[isUk ? "uk" : "en"])[result.personastate || 0]}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-primary" onClick={() => navigate(`/profile/${result.steam_id}`)}>
              {t("search.viewProfile")}
            </button>
            <a href={result.profileurl} target="_blank" rel="noreferrer"
              className="btn btn-outline" style={{ textDecoration: "none" }}>
              Steam ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
