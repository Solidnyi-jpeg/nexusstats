import { useNavigate } from "react-router-dom";

export default function GameRow({ game, rank }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 8px", borderRadius: "6px",
      transition: "background 0.15s", cursor: "pointer",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    onClick={() => game.platform && game.platform_game_id && navigate(`/games/${game.platform}/${game.platform_game_id}`)}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem", width: "24px", textAlign: "center", flexShrink: 0 }}>
        #{rank}
      </span>
      {game.img_icon_url ? (
        <img src={game.img_icon_url} alt={game.name}
          style={{ width: "32px", height: "32px", borderRadius: "4px", flexShrink: 0 }}
          onError={e => e.target.style.display = "none"} />
      ) : (
        <div style={{ width: "32px", height: "32px", background: "var(--border)", borderRadius: "4px", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text-bright)", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {game.name}
        </div>
        {game.achievement_total > 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>
            🏆 {game.achievement_count}/{game.achievement_total}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "0.9rem" }}>
          {game.playtime_hours}h
        </div>
        {game.playtime_2weeks_hours > 0 && (
          <div style={{ color: "var(--accent-green)", fontSize: "0.72rem" }}>
            +{game.playtime_2weeks_hours}h
          </div>
        )}
      </div>
    </div>
  );
}
