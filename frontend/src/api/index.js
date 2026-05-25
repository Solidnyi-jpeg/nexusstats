import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

export const getOverview = (platform) =>
  api.get("/debug/overview", { params: platform ? { platform } : {} });
export const getDbStats = () => api.get("/debug/stats");
export const setupDebug = (steamId) =>
  api.post(`/debug/setup?steam_id=${steamId}`);
export const syncDebug = () => api.post("/debug/sync");
export const searchPlayer = (query) =>
  api.get("/platforms/steam/search", { params: { query } });
export const getFriends = (steamId) =>
  api.get(`/platforms/steam/friends/${steamId}`);
export const getPublicProfile = (steamId) =>
  api.get(`/profile/${steamId}/public`);

export { API_URL };
export default api;
