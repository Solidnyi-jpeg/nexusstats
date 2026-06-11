import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../api"; 

export default function Welcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const authError = searchParams.get("error");

    if (authError) {
      setError(authError === "auth_failed" ? "Помилка авторизації. Спробуйте ще раз." : authError);
    }

    if (urlToken) {
      localStorage.setItem("token", urlToken);
      window.location.href = "/dashboard";
      return; 
    }

    const existingToken = localStorage.getItem("token");
    if (existingToken) {
      try {
        const payload = JSON.parse(atob(existingToken.split(".")[1]));
        if (payload.exp * 1000 > Date.now()) {
          window.location.href = "/dashboard";
        } else {
          localStorage.removeItem("token");
        }
      } catch {
        localStorage.removeItem("token");
      }
    }
  }, [searchParams]);

  const handleSteamLogin = () => {
    setLoading(true);
    window.location.href = `${API_URL}/api/v1/auth/steam/login`;
  };

  /* const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = `${API_URL}/api/v1/oauth/google/login`;
  };
  */

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", padding: "20px"
    }}>
      <div className="card" style={{ width: 400, padding: "48px 36px", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎮</div>
        <h1 style={{ color: "var(--accent)", fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>
          NexusStats
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "36px", lineHeight: 1.5 }}>
          Мультиплатформна ігрова аналітика
        </p>

        {error && (
          <div style={{
            background: "rgba(239,83,80,.12)", border: "1px solid var(--accent-red)",
            color: "#f87171", borderRadius: "var(--radius)", padding: "10px 14px",
            marginBottom: "20px", fontSize: ".875rem",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Кнопка Steam */}
          <button
            onClick={handleSteamLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "14px", borderRadius: "var(--radius)",
              border: "none", background: "#171a21", color: "#fff",
              fontWeight: 700, fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#2a475e"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#171a21"; }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M11.979 0C5.357 0 0 5.357 0 11.979c0 4.673 2.68 8.742 6.643 10.74l3.197-4.634c-.201-.41-.318-.868-.318-1.353 0-1.74 1.411-3.15 3.15-3.15.347 0 .678.058.988.162l2.846-4.093v-.358c0-2.457 1.993-4.45 4.45-4.45s4.45 1.993 4.45 4.45-1.993 4.45-4.45 4.45c-.328 0-.645-.037-.947-.105l-4.108 2.856h-.363c0 2.457-1.993 4.45-4.45 4.45-1.127 0-2.155-.42-2.946-1.111l-4.62 3.19C7.452 23.57 9.645 24 11.98 24 18.602 24 24 18.643 24 12.021 24 5.4 18.643 0 11.979 0zm9.426 9.227c0 1.258-1.022 2.28-2.28 2.28s-2.28-1.022-2.28-2.28 1.022-2.28 2.28-2.28 2.28 1.022 2.28 2.28zm-9.829 8.675c0 1.222-.99 2.213-2.213 2.213-1.222 0-2.213-.991-2.213-2.213 0-1.222.991-2.213 2.213-2.213 1.222 0 2.213.991 2.213 2.213z"/>
            </svg>
            {loading ? "Зачекайте..." : "Увійти через Steam"}
          </button>

          {/* ЗААРХІВОВАНО НА МАЙБУТНЄ: Кнопка Google Play 
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "14px", borderRadius: "var(--radius)",
              border: "2px solid #a2b3a7", background: "transparent", color: "var(--text-primary)",
              fontWeight: 700, fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => { 
              if (!loading) { 
                e.currentTarget.style.background = "#b90000"; 
                e.currentTarget.style.color = "#fff"; 
              } 
            }}
            onMouseLeave={(e) => { 
              if (!loading) { 
                e.currentTarget.style.background = "transparent"; 
                e.currentTarget.style.color = "var(--text-primary)"; 
              } 
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
            </svg>
            {loading ? "Зачекайте..." : "Увійти через Google"}
          </button>
          */}

        </div> 
        <p style={{ color: "var(--text-secondary)", fontSize: ".75rem", marginTop: "24px" }}>
          Увійдіть за допомогою свого акаунту Steam, щоб почати відстежувати ігрову статистику.
        </p>
      </div>
    </div>
  );
}