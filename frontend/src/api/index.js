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
    // Шукаємо токен в localStorage (перевіряємо обидві назви для надійності)
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Перехоплювач відповідей
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Якщо бекенд каже 401 (Неавторизовано) - значить токен згорів або недійсний
    if (error.response && error.response.status === 401) {
      console.warn("Токен недійсний або закінчився. Виконуємо вихід...");
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
      
      // Якщо ми вже не на сторінці welcome, кидаємо туди
      if (window.location.pathname !== "/welcome") {
        window.location.href = "/welcome";
      }
    }
    return Promise.reject(error);
  }
);

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


// ==========================================
// НОВІ ЕНДПОІНТИ (ПЛАТФОРМИ ТА МУЛЬТИ-ЛОГІН)
// ==========================================

// --- Логін та Авторизація ---
export const loginWargaming = async (data) => {
  return await api.post("/auth/wargaming/login", data);
};

// --- Підключення платформ до існуючого профілю ---
export const connectPlaystation = async (psn_data) => {
  return await api.post("/platforms/connect/playstation", psn_data);
};

export const connectWargaming = async (data) => {
  return await api.post("/platforms/connect/wargaming", data);
};

// --- Управління підключеннями ---
export const getConnections = async () => {
  return await api.get("/platforms/connections");
};

export const disconnectPlatform = async (platformName) => {
  return await api.delete(`/platforms/connect/${platformName}`);
};

// --- Специфічна статистика ---
export const getWgStats = async () => {
  return await api.get("/analytics/wargaming");
};


export { API_URL };
export default api;