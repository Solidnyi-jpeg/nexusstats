import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPublicProfile } from "../api";
import GameRow from "../components/GameRow";

export default function FriendProfile() {
  const { steamId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicProfile(steamId)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [steamId]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--accent)" }}>Loading profile...</div>
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: "center", padding: "60px" }}>
      <div style={{ color: "var(--accent-red)" }}>Profile not found</div>
    </div>
  );

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
      <button onClick={() => navigate(-1)} style={{
        background: "none", border: "none", color: "var(--text-secondary)",
        cursor: "pointer", marginBottom: "20px", fontSize: "0.9rem",
      }}>← Back</button>

      {/* Profile Header */}
      <div className="card" style={{ padding: "32px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {data.avatar && (
            <img src={data.avatar} style={{ width: "96px", height: "96px", borderRadius: "10px" }} />
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "var(--text-bright)", fontSize: "1.8rem", marginBottom: "4px" }}>
              {data.personaname}
            </h1>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "12px" }}>
              Steam ID: {data.steam_id}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <a href={data.profileurl} target="_blank" rel="noreferrer"
                className="btn btn-outline" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
                Steam Profile ↗
              </a>
            </div>
          </div>

          {data.is_synced && data.analytics && (
            <div style={{ display: "flex", gap: "16px" }}>
              {[
                { label: "Games", value: data.analytics.total_games, icon: "🎮" },
                { label: "Hours", value: `${data.analytics.total_hours}h`, icon: "⏱️" },
                { label: "Achievements", value: data.analytics.total_achievements, icon: "🏆" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
                  <div style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "1.2rem" }}>{s.value}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Games */}
      {data.analytics?.top_games?.length > 0 && (
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ color: "var(--text-bright)", marginBottom: "16px", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🏆 Top Games
          </h3>
          {data.analytics.top_games.map((g, i) => (
            <GameRow key={g.game_id} game={g} rank={i + 1} />
          ))}
        </div>
      )}

      {!data.is_synced && (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔒</div>
          <div style={{ color: "var(--text-secondary)" }}>
            This player hasn't synced their data with NexusStats yet
          </div>
        </div>
      )}
    </div>
  );
}
