import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { searchPlayer } from "../api";
import { useApp } from "../store";


// Статуси Steam: 0-Offline, 1-Online, 2-Busy, 3-Away, 4-Snooze, 5-Trade, 6-Play
const STATUS_MAP = {
  0: { label: { uk: "Офлайн", en: "Offline" }, color: "var(--border)" },
  1: { label: { uk: "Онлайн", en: "Online" }, color: "var(--accent-green)" },
  2: { label: { uk: "Зайнятий", en: "Busy" }, color: "#66c0f4" },
  3: { label: { uk: "Відійшов", en: "Away" }, color: "#f8c63a" },
  4: { label: { uk: "Не турбувати", en: "Snooze" }, color: "#ab47bc" },
  5: { label: { uk: "Торгівля", en: "Trade" }, color: "#76d6ff" },
  6: { label: { uk: "Грає", en: "Playing" }, color: "var(--accent-green)" },
};

const PlayerResultCard = ({ result, isUk, navigate, t }) => {
  const status = STATUS_MAP[result.personastate] || STATUS_MAP[0];
  const label = isUk ? status.label.uk : status.label.en;
  const steamId = result.steam_id || result.steamid;

  return (
    <div className="card result-card">
      <div className="player-info">
        <div className="avatar-wrapper">
          {result.avatarmedium && <img src={result.avatarmedium} alt={result.personaname} />}
          <div className="status-indicator" style={{ background: status.color }} />
        </div>
        <div className="details">
          <h3 className="player-name">{result.personaname}</h3>
          <p className="steam-id">Steam ID: {steamId}</p>
          <div className="status-text" style={{ color: status.color }}>
            <span className="dot" style={{ background: status.color }} />
            {label}
          </div>
        </div>
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={() => navigate(`/profile/${steamId}`)}>
          {t("search.viewProfile", { defaultValue: isUk ? "Переглянути профіль" : "View Profile" })}
        </button>
        {result.profileurl && (
          <a href={result.profileurl} target="_blank" rel="noreferrer" className="btn btn-outline">
            Steam ↗
          </a>
        )}
      </div>
    </div>
  );
};

export default function Search() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useApp();
  const isUk = language === "uk";

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
      if (!res.data?.found) {
        setError(res.data?.error || t("search.notFound", { defaultValue: isUk ? "Гравця не знайдено" : "Player not found" }));
      } else {
        setResult(res.data);
      }
    } catch {
      setError(t("search.notFound", { defaultValue: isUk ? "Гравця не знайдено" : "Player not found" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-container">
      <h1 className="search-title">🔍 {t("search.title", { defaultValue: isUk ? "Пошук гравців" : "Search Players" })}</h1>

      <div className="search-input-group">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={t("search.placeholder", { defaultValue: isUk ? "Введіть нік або Steam ID..." : "Enter nickname or Steam ID..." })}
          className={`search-input ${error ? "error" : ""}`}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !query.trim()} aria-label="Search">
          {loading ? "⏳" : "🔍"}
        </button>
      </div>

      <div className="search-hint">
        {isUk ? "Введіть нікнейм Steam (vanity URL) або Steam ID64" : "Enter Steam nickname (vanity URL) or Steam ID64"}
      </div>

      {error && (
        <div className="card error-card">
          <div className="error-icon">😕</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {result && <PlayerResultCard result={result} isUk={isUk} navigate={navigate} t={t} />}
    </div>
  );
}



