import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  // Усі запити автоматично йтимуть на /api/v1
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
});

// Перехоплювач запитів — автоматично підкидає токен
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ... твій імпорт axios та налаштування ...

// Додаємо перехоплювач відповідей
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Якщо бекенд каже 401 (Неавторизовано) - значить токен згорів або недійсний
    if (error.response && error.response.status === 401) {
      console.warn("Токен недійсний або закінчився. Виконуємо вихід...");
      localStorage.removeItem("token");
      
      // Якщо ми вже не на сторінці welcome, кидаємо туди
      if (window.location.pathname !== "/welcome") {
        window.location.href = "/welcome";
      }
    }
    return Promise.reject(error);
  }
);

// ... далі твої експорти функцій (getOverview, getPublicProfile і т.д.)

// ==========================================
// ЕНДПОІНТИ (ENDPOINTS)
// ==========================================

// --- Аналітика та Статистика ---
export const getOverview = (platform, steamId = null) =>
  api.get("/analytics/overview", { params: { platform, steam_id: steamId } });

export const getRareAchievements = (limit = 50, steamId = null) =>
  api.get("/analytics/achievements/rare", { params: { limit, steam_id: steamId } });

export const getGameAchievements = (platformGameId, steamId = null) =>
  api.get(`/analytics/games/${platformGameId}/achievements`, { params: { steam_id: steamId } });

export const getDotaStats = () => {
  return api.get("/games/dota2/stats"); 
};

export const getCsStats = () => {
  return api.get("/games/cs/stats");
};

// --- Ігри (Бібліотека) ---
export const getAllGames = () =>
  api.get("/games/list/all");

export const getGameDetail = (platform, platformGameId, viewerSteamId = null) =>
  api.get(`/games/${platform}/${platformGameId}`, { params: { viewer_steam_id: viewerSteamId } });


// --- Платформи та Друзі ---
export const searchPlayer = (query) =>
  api.get("/platforms/steam/search", { params: { query } });

export const getFriends = (steamId) =>
  api.get(`/platforms/steam/friends/${steamId}`);

export const forceSyncCurrentUser = () =>
  api.post("/platforms/steam/force-sync");

export const disconnectSteam = () =>
  api.post("/platforms/disconnect/steam");


// --- Профілі (Закладки та публічні сторінки) ---
export const getPublicProfile = (steamId) => 
  api.get(`/profile/${steamId}`);

export const getProfilePreview = (steamId) => 
  api.get(`/profile/${steamId}/preview`);

export const syncProfileData = (steamId) => 
  api.post(`/profile/${steamId}/sync`);


// --- Debug (Тільки для розробки) ---
export const setupDebug = (steamId) =>
  api.post(`/debug/setup?steam_id=${steamId}`);

export const clearDebugData = () =>
  api.post("/debug/clear");


export { API_URL };
export default api;