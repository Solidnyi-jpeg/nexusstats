import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store";
import api, { getOverview } from "../api"; // Підключаємо api для запитів вибраного

// --- Окремий підкомпонент для картки друга ---
function FriendCard({ f, isUk, navigate, onToggleStar }) {
  const [isHovered, setIsHovered] = useState(false);
  const currentFriendId = f.steam_id || f.steamid;

  const handleClick = () => {
    navigate(`/profile/${currentFriendId}`);
  };

  const handleStarClick = (e) => {
    e.stopPropagation(); // Блокуємо перехід на сторінку профілю при кліку на зірку
    onToggleStar(f, !f.isFavorite);
  };

  return (
    <div 
      role="button"
      tabIndex={0}
      className="card"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        padding: "16px", 
        display: "flex", 
        gap: "12px", 
        alignItems: "center", 
        cursor: "pointer", 
        transition: "border-color 0.15s ease",
        borderColor: isHovered ? "var(--accent)" : "var(--border)"
      }}
    >
      {f.avatar && (
        <img src={f.avatar} style={{ width: "48px", height: "48px", borderRadius: "6px", flexShrink: 0 }} alt="" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text-bright)", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {f.personaname}
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {f.gameextrainfo ? (
            <span style={{ color: "var(--accent-green)", fontWeight: "600" }}>🎮 {f.gameextrainfo}</span>
          ) : f.friend_since ? (
            `${isUk ? "Друзі з" : "Friends since"} ${new Date(f.friend_since * 1000).getFullYear()}`
          ) : (
            "Steam Friend"
          )}
        </div>
      </div>
      
      {/* Інтерактивна кнопка-зірочка */}
      <button 
        onClick={handleStarClick}
        title={f.isFavorite ? (isUk ? "Видалити з вибраного" : "Remove from favorites") : (isUk ? "Додати у вибране" : "Add to favorites")}
        style={{ 
          background: "none", 
          border: "none", 
          fontSize: "1.3rem", 
          cursor: "pointer", 
          flexShrink: 0,
          color: f.isFavorite ? "var(--accent-gold, #f8c63a)" : "var(--text-secondary)",
          opacity: f.isFavorite || isHovered ? 1 : 0.3,
          transition: "transform 0.1s, opacity 0.2s, color 0.2s",
          transform: isHovered ? "scale(1.1)" : "scale(1)"
        }}
      >
        {f.isFavorite ? "⭐" : "☆"}
      </button>
    </div>
  );
}

// --- Головний компонент ---
export default function Friends() {
  const navigate = useNavigate();
  const { language } = useApp();
  const isUk = language === "uk";

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    // Паралельно завантажуємо друзів і список вибраного
    Promise.all([
      getOverview(),
      api.get("/profile/bookmarks") // Запит за вибраними
    ])
      .then(([overviewRes, favRes]) => {
        const data = overviewRes.data;
        const favorites = favRes.data || [];
        
        // Створюємо Set із SteamID тих, хто у вибраному (для швидкого пошуку)
        const favSet = new Set(favorites.map(fav => fav.platform_user_id));
        
        const hasSteam = data.platforms_breakdown?.some(p => p.platform === "steam") || data.connected_platforms?.includes("steam");
        
        if (!hasSteam) {
          setNotConnected(true);
        } else {
          // Додаємо статус isFavorite кожному другу
          const mappedFriends = (data.friends || []).map(f => ({
            ...f,
            isFavorite: favSet.has(f.steam_id || f.steamid)
          }));
          
          // Сортуємо: Вибрані (true) завжди йдуть першими, потім інші
          mappedFriends.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
          setFriends(mappedFriends);
        }
      })
      .catch(err => {
        console.error("Збій завантаження:", err);
        setNotConnected(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Логіка додавання/видалення зірочки
  const handleToggleStar = async (friend, makeFavorite) => {
    const sid = friend.steam_id || friend.steamid;
    
    // Оптимістичне оновлення UI (одразу змінюємо стейт, не чекаючи бекенд)
    setFriends(prev => {
      const updated = prev.map(f => (f.steam_id || f.steamid) === sid ? { ...f, isFavorite: makeFavorite } : f);
      // Одразу пересортовуємо масив
      return updated.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
    });

    try {
      if (makeFavorite) {
        const params = new URLSearchParams({
          platform: "steam",
          platform_user_id: sid,
          display_name: friend.personaname || "",
          avatar_url: friend.avatar || "",
        });
        await api.post(`/profile/bookmarks?${params.toString()}`);
      } else {
        await api.delete(`/profile/bookmarks/steam/${sid}`);
      }
    } catch (err) {
      console.error("Помилка оновлення вибраного:", err);
      // У разі помилки повертаємо стан назад
      setFriends(prev => {
        const reverted = prev.map(f => (f.steam_id || f.steamid) === sid ? { ...f, isFavorite: !makeFavorite } : f);
        return reverted.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
      });
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--accent)", fontSize: "1.1rem" }}>
        {isUk ? "Завантаження списку друзів..." : "Loading friends list..."}
      </div>
    </div>
  );

  if (notConnected) return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: "16px" }} aria-hidden="true">👥</div>
      <h2 style={{ color: "var(--text-bright)", marginBottom: "8px" }}>
        {isUk ? "Steam не підключено" : "Steam not connected"}
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
        {isUk ? "Підключіть Steam акаунт щоб бачити список друзів" : "Connect your Steam account to see your friends list"}
      </p>
      <button className="btn btn-primary" onClick={() => navigate("/settings")}>
        {isUk ? "Підключити Steam" : "Connect Steam"}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
      <h1 style={{ color: "var(--text-bright)", marginBottom: "24px", fontSize: "1.5rem" }}>
        👥 {isUk ? "Мережа друзів" : "Friends"} {friends.length > 0 && `(${friends.length})`}
      </h1>

      {friends.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }} aria-hidden="true">👥</div>
          <div style={{ color: "var(--text-secondary)" }}>
            {isUk ? "Список друзів закритий налаштуваннями приватності або порожній" : "Friends list is private or empty"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
          {friends.map(f => (
            <FriendCard key={f.steam_id || f.steamid} f={f} isUk={isUk} navigate={navigate} onToggleStar={handleToggleStar} />
          ))}
        </div>
      )}
    </div>
  );
}