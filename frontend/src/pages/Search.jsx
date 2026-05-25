import { useState } from "react";
import { useTranslation } from "react-i18next";
import { searchPlayer } from "../api";

export default function Search() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await searchPlayer(query.trim());
      setResult(res.data);
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", marginBottom: "24px", fontSize: "1.5rem" }}>
        🔍 {t("search.title")}
      </h1>

      <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={t("search.placeholder")}
          style={{
            flex: 1, padding: "12px 16px",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", color: "var(--text-primary)",
            fontSize: "1rem", outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = "var(--accent)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "..." : "🔍"}
        </button>
      </div>

      {result && !result.found && (
        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>😕</div>
          <div style={{ color: "var(--text-secondary)" }}>{t("search.notFound")}</div>
        </div>
      )}

      {result?.found && result.profile && (
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
            {result.profile.avatar && (
              <img src={result.profile.avatarfull || result.profile.avatar}
                style={{ width: "80px", height: "80px", borderRadius: "8px" }} />
            )}
            <div>
              <div style={{ color: "var(--text-bright)", fontSize: "1.3rem", fontWeight: "bold" }}>
                {result.profile.personaname}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Steam ID: {result.steam_id}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <a href={`/profile/${result.steam_id}`}
              className="btn btn-primary" style={{ textDecoration: "none" }}>
              {t("search.viewProfile")}
            </a>
            <button className="btn btn-outline">
              🔖 {t("search.bookmark")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
