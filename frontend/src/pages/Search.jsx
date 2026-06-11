import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STATE_COLORS = ["var(--border)","#4caf50","#66c0f4","#f8c63a","#f8c63a","#ab47bc","#4caf50"];
const STATE_UK     = ["Офлайн","Онлайн","Зайнятий","Відійшов","Відійшов","Не турбувати","Грає"];
const STATE_EN     = ["Offline","Online","Busy","Away","Away","Snooze","In-Game"];

export default function Search() {
  const navigate = useNavigate();
  const { language } = useApp();
  const uk = language === "uk";

  const [query,   setQuery]   = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setResult(null); setError("");
    try {
      const res  = await fetch(
        `${API}/api/v1/platforms/steam/search?query=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      const data = await res.json();
      if (!res.ok || !data.found) {
        setError(data.error || (uk ? "Гравця не знайдено" : "Player not found"));
      } else {
        setResult(data);
      }
    } catch {
      setError(uk ? "Помилка з'єднання з сервером" : "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth:600, margin:"40px auto", padding:"0 24px" }}>
      <h1 style={{ color:"var(--text-bright)", fontSize:"1.5rem", marginBottom:24 }}>
        🔍 {uk ? "Пошук гравців" : "Search Players"}
      </h1>

      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          placeholder={uk ? "Нік або Steam ID64..." : "Nickname or Steam ID64..."}
          style={{
            flex:1, padding:"10px 14px",
            background:"var(--bg-card)", border:`1px solid ${error ? "var(--accent-red)" : "var(--border)"}`,
            borderRadius:"var(--radius)", color:"var(--text-primary)", fontSize:".95rem", outline:"none",
          }}
        />
        <button
          className="btn btn-primary"
          onClick={doSearch}
          disabled={loading || !query.trim()}
          style={{ padding:"10px 20px", fontSize:"1rem" }}
        >
          {loading ? "⏳" : "🔍"}
        </button>
      </div>

      <div style={{ color:"var(--text-secondary)", fontSize:".78rem", marginBottom:20 }}>
        {uk ? "Введіть Steam ID64 (17 цифр) або vanity URL нікнейм" : "Enter Steam ID64 (17 digits) or vanity URL nickname"}
      </div>

      {error && (
        <div className="card" style={{ padding:"20px 24px", borderColor:"var(--accent-red)44", display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:"1.5rem" }}>😕</span>
          <span style={{ color:"var(--text-secondary)" }}>{error}</span>
        </div>
      )}

      {result && (
        <div className="card" style={{ padding:20 }}>
          <div style={{ display:"flex", gap:16, alignItems:"center" }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              {result.avatarmedium
                ? <img src={result.avatarmedium} style={{ width:64, height:64, borderRadius:8 }} alt="" />
                : <div style={{ width:64, height:64, borderRadius:8, background:"var(--bg-hover)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.8rem" }}>👤</div>
              }
              <div style={{
                position:"absolute", bottom:2, right:2, width:12, height:12, borderRadius:"50%",
                background: STATE_COLORS[result.personastate ?? 0],
                border:"2px solid var(--bg-card)",
              }} />
            </div>

            <div style={{ flex:1 }}>
              <div style={{ color:"var(--text-bright)", fontWeight:700, fontSize:"1.1rem", marginBottom:4 }}>
                {result.personaname}
              </div>
              <div style={{ color:"var(--text-secondary)", fontSize:".78rem", marginBottom:8 }}>
                Steam ID: {result.steam_id}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background: STATE_COLORS[result.personastate ?? 0] }} />
                <span style={{ color: STATE_COLORS[result.personastate ?? 0], fontSize:".78rem" }}>
                  {uk ? STATE_UK[result.personastate ?? 0] : STATE_EN[result.personastate ?? 0]}
                </span>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/profile/${result.steam_id}`)}
                style={{ fontSize:".85rem" }}
              >
                {uk ? "Переглянути профіль" : "View Profile"}
              </button>
              {result.profileurl && (
                <a href={result.profileurl} target="_blank" rel="noreferrer"
                  className="btn btn-outline" style={{ textDecoration:"none", fontSize:".85rem", textAlign:"center" }}>
                  Steam ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}