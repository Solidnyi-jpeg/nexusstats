import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./store"; 

// Імпортуємо компоненти
import Navbar from "./components/Navbar"; 
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Achievements from "./pages/Achievements";
import Friends from "./pages/Friends";
import Search from "./pages/Search";
import Settings from "./pages/Settings";
import GameDetail from "./pages/GameDetail";
import FriendProfile from "./pages/FriendProfile";
import DotaStats from "./pages/DotaStats";
import CsStats from "./pages/CsStats";
import EsportsHub from "./pages/EsportsHub";
import WGCallback from "./pages/WGCallback";
import WoTStats from "./pages/WoTStats"; // <--- ДОДАНО ІМПОРТ WOTSTATS

// Компонент-обгортка для захисту приватних сторінок
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token") || localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/welcome" replace />;
  }
  return children;
};

// Layout-обгортка, яка показує Navbar тільки для авторизованих користувачів
const AppLayout = ({ children }) => {
  const token = localStorage.getItem("token") || localStorage.getItem("access_token");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
      {token && <Navbar />}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto", color: "var(--text-primary)" }}>
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppLayout>
          <Routes>
            {/* Розумний базовий редирект */}
            <Route 
              path="/" 
              element={
                (localStorage.getItem("token") || localStorage.getItem("access_token"))
                  ? <Navigate to="/dashboard" replace /> 
                  : <Navigate to="/welcome" replace />
              } 
            />
            
            {/* Публічні маршрути для входу */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/auth/callback" element={<Welcome />} /> 
            
            {/* Маршрут для перехоплення відповіді від Wargaming */}
            <Route path="/wg-callback" element={<WGCallback />} />

            {/* Приватні маршрути */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/achievements" element={
              <ProtectedRoute>
                <Achievements />
              </ProtectedRoute>
            } />
            
            <Route path="/friends" element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            } />
            
            <Route path="/search" element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            } />
            
             {/* Кіберспортивні аналітики */}
              <Route path="/dota" element={
                <ProtectedRoute>
                  <DotaStats />
                </ProtectedRoute>
              } />

              <Route path="/cs" element={
                <ProtectedRoute>
                  <CsStats />
                </ProtectedRoute>
              } />

              <Route path="/wot" element={
                <ProtectedRoute>
                  <WoTStats />
                </ProtectedRoute>
              } />

            <Route path="/games/:platform/:gameId" element={
              <ProtectedRoute>
                <GameDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/esports" element={
              <ProtectedRoute>
                  <EsportsHub />
              </ProtectedRoute>
            } />

             <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />

            <Route path="/profile/:steamId" element={
              <ProtectedRoute>
                <FriendProfile />
              </ProtectedRoute>
            } />
            
            {/* Fallback для невідомих адрес */}
            <Route 
              path="*" 
              element={
                (localStorage.getItem("token") || localStorage.getItem("access_token"))
                  ? <Navigate to="/dashboard" replace /> 
                  : <Navigate to="/welcome" replace />
              } 
            />
          </Routes>
        </AppLayout>
      </Router>
    </AppProvider>
  );
}