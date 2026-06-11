import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function GameRow({ game, rank }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleNavigation = () => {
    if (game.platform && game.platform_game_id) {
      navigate(`/games/${game.platform}/${game.platform_game_id}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 8px",
        borderRadius: "6px",
        transition: "background 0.15s ease",
        cursor: "pointer",
        background: isHovered ? "var(--bg-hover)" : "transparent",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNavigation}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNavigation();
        }
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem", width: "24px", textAlign: "center", flexShrink: 0 }}>
        #{rank}
      </span>
      
      {game.img_icon_url && !imgError ? (
        <img 
          src={game.img_icon_url} 
          alt={game.name}
          style={{ width: "32px", height: "32px", borderRadius: "4px", flexShrink: 0 }}
          onError={() => setImgError(true)} 
        />
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