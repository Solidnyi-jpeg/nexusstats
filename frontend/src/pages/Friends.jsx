import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getFriends } from "../api";

export default function Friends() {
  const { t } = useTranslation();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const STEAM_ID = "76561199376119572";

  useEffect(() => {
    getFriends(STEAM_ID)
      .then(res => setFriends(res.data))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--accent)" }}>{t("common.loading")}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", marginBottom: "24px", fontSize: "1.5rem" }}>
        👥 {t("nav.friends")} ({friends.length})
      </h1>

      {friends.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>👥</div>
          <div style={{ color: "var(--text-secondary)" }}>Friends list is private or empty</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {friends.map(f => (
            <div key={f.steam_id} className="card" style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
              {f.avatar && (
                <img src={f.avatar} style={{ width: "48px", height: "48px", borderRadius: "6px" }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "var(--text-bright)", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.personaname}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                  {f.friend_since ? `Friends since ${new Date(f.friend_since * 1000).getFullYear()}` : "Steam Friend"}
                </div>
              </div>
              <button onClick={() => navigate(`/profile/${f.steam_id}`)}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.8rem" }}>
                View →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
