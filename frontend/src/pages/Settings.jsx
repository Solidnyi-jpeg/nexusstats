import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store';
import api, { getOverview } from '../api'; // 🔌 Підключаємо наш налаштований Axios
import './Settings.css';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { language } = useApp();
  const isUk = language === "uk";

  const [connections, setConnections] = useState({
    steam: false,
    epic: false,
    xbox: false,
    googleplay: false,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. ПЕРЕВІРКА НАЯВНИХ ПІДКЛЮЧЕНЬ ПРИ ВХОДІ НА СТОРІНКУ
  useEffect(() => {
    // Тепер ми просто викликаємо функцію з api.js, яка сама додасть токен
    getOverview()
      .then(response => {
        const overviewData = response.data;
        const hasSteam = overviewData.platforms_breakdown?.some(p => p.platform === "steam") || overviewData.total_games > 0;
        setConnections(prev => ({ ...prev, steam: !!hasSteam }));
      })
      .catch(error => {
        console.error('Помилка перевірки статусів платформ:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // 2. ОБРОБКА ПОВЕРНЕННЯ ЗІ STEAM OPENID
  useEffect(() => {
    const status = searchParams.get('status');
    // В нашому бекенді ми повертаємо просто ?sync=success, але я залишив твою логіку для сумісності.
    // Якщо ти робив редирект на /dashboard?sync=success, то тут варто перевірити саме це.
    const syncStatus = searchParams.get('sync'); 

    if (status === 'success' || syncStatus === 'success') {
      setConnections(prev => ({ ...prev, steam: true }));
      setSearchParams({}); // Очищаємо URL
      
      alert(isUk 
        ? 'Ваш акаунт Steam успішно синхронізовано!' 
        : 'Your Steam account has been successfully synchronized!'
      );
    }
  }, [searchParams, setSearchParams, isUk]);

  // 3. ІНІЦІАЛІЗАЦІЯ ПІДКЛЮЧЕННЯ STEAM
  const handleConnectSteam = async () => {
    setActionLoading(true);
    try {
      // Використовуємо наш екземпляр api
      const response = await api.get('/platforms/connect/steam');
      
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        alert(isUk ? 'Не вдалося отримати посилання для авторизації від бекенду.' : 'Failed to receive authorization URL from backend.');
      }
    } catch (error) {
      console.error('Помилка при спробі підключення Steam:', error);
      alert(isUk ? 'Сталася помилка з\'єднання з сервером API.' : 'API Server connection error.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. ЛОГІКА ВІДКЛЮЧЕННЯ STEAM АКАУНТА
  const handleDisconnectSteam = async () => {
    const confirmText = isUk 
      ? "Ви впевнені, що хочете відключити Steam? Усі проіндексовані ігри та досягнення будуть видалені з бази даних."
      : "Are you sure you want to disconnect Steam? All indexed games and stats will be removed from the database.";
      
    if (!window.confirm(confirmText)) return;

    setActionLoading(true);
    try {
      // Використовуємо правильний ендпоінт через axios
      await api.delete('/profile/connections/steam');
      
      setConnections(prev => ({ ...prev, steam: false }));
      alert(isUk ? "Акаунт успішно відключено!" : "Account disconnected successfully!");
    } catch (error) {
      console.error('Помилка відключення Steam:', error);
      alert(isUk ? 'Сталася помилка на сервері.' : 'Server error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--accent)", fontSize: "1.1rem" }}>
        {isUk ? "Завантаження конфігурації..." : "Loading configuration..."}
      </div>
    </div>
  );

  return (
    <div className="settings-page">
      <h2>{isUk ? "Керування підключеними платформами" : "Connected Platforms Management"}</h2>
      <p className="subtitle">
        {isUk 
          ? "Безпечно підключайте ігрові профілі в один клік без ручного введення ID." 
          : "Securely link your gaming profiles in one click without manual ID input."}
      </p>

      <div className="platforms-grid">
        {/* Кнопка STEAM */}
        <div className={`platform-card ${connections.steam ? 'connected' : ''}`}>
          <div className="platform-info">
            <div className="platform-icon steam"></div>
            <div>
              <h3>Steam</h3>
              <p>
                {connections.steam 
                  ? (isUk ? 'Акаунт успішно підключено' : 'Account connected') 
                  : (isUk ? 'Офіційна авторизація Steam OpenID' : 'Official Steam OpenID authorization')}
              </p>
            </div>
          </div>
          {connections.steam ? (
            <button 
              onClick={handleDisconnectSteam} 
              className="btn-secondary disconnect"
              disabled={actionLoading}
            >
              {actionLoading ? "⏳" : (isUk ? "Вимкнути" : "Disconnect")}
            </button>
          ) : (
            <button 
              onClick={handleConnectSteam} 
              className="btn-platform steam-btn"
              disabled={actionLoading}
            >
              {actionLoading ? "⏳" : (isUk ? "Увійти через Steam" : "Sign in through Steam")}
            </button>
          )}
        </div>

        {/* Інші платформи залишаються заблокованими для майбутніх інтеграцій */}
        <div className="platform-card disabled">
          <div className="platform-info">
            <div className="platform-icon epic"></div>
            <div>
              <h3>Epic Games Store</h3>
              <p>{isUk ? "Доступно незабаром (OAuth2)" : "Coming soon (OAuth2)"}</p>
            </div>
          </div>
          <button className="btn-platform" disabled>
            {isUk ? "Підключити" : "Connect"}
          </button>
        </div>

        <div className="platform-card disabled">
          <div className="platform-info">
            <div className="platform-icon xbox"></div>
            <div>
              <h3>Xbox Network</h3>
              <p>{isUk ? "Доступно незабаром (Xbox Live LiveID)" : "Coming soon (Xbox Live LiveID)"}</p>
            </div>
          </div>
          <button className="btn-platform" disabled>
            {isUk ? "Підключити" : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}