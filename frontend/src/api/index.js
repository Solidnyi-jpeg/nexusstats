import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  // КРОК 1: Додаємо версійний префікс автоматично для ВСІХ запитів
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
});

// КРОК 2: Перехоплювач запитів — автоматично підкидає токен з Welcome.jsx
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // Ключ збігається з Welcome.jsx
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// КРОК 3: Перехоплювач відповідей — гасить спам "Signature has expired"
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Сесія застаріла або токен недійсний. Очищення пам'яті.");
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      
      // Перенаправляємо на сторінку входу, якщо токен "вмер"
      window.location.href = "/welcome"; 
    }
    return Promise.reject(error);
  }
);

// --- Ендпоінти (Тепер вони автоматично підхоплюють /api/v1 завдяки baseURL) ---

export const getOverview = (platform) =>
  api.get("/debug/overview", { params: platform ? { platform } : {} });

export const getDbStats = () => api.get("/debug/stats");

export const setupDebug = (steamId) =>
  api.post(`/debug/setup?steam_id=${steamId}`);

export const syncDebug = () => api.post("/debug/sync");

// ТЕПЕР ЦЕЙ ЗАПИТ ПОЛЕТИТЬ НА /api/v1/platforms/steam/search ТА ПОВЕРНЕ 200 OK!
export const searchPlayer = (query) =>
  api.get("/platforms/steam/search", { params: { query } });

export const getFriends = (steamId) =>
  api.get(`/platforms/steam/friends/${steamId}`);

// ВИПРАВЛЕНО: Прибрали зайвий /public, бо на бекенді шлях просто /profile/{steam_id}
export const getPublicProfile = (steamId) => 
  api.get(`/profile/${steamId}`);

// ДОДАНО: Швидкий ендпоінт для карток-прев'ю профілю, який ми щойно створили
export const getProfilePreview = (steamId) => 
  api.get(`/profile/${steamId}/preview`);

// Додай цей рядок до інших експортів у твоему src/api.js
export const syncProfileData = (steamId) => 
  api.post(`/profile/${steamId}/sync`);

// Додай до інших експортів у твоему src/api.js
export const getGameAchievements = (gameId, steamId) =>
  api.get(`/analytics/games/${gameId}/achievements`, { params: { steam_id: steamId } });

export { API_URL };
export default api;