import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useApp } from "../store"; // 🔌 Підключаємо твій глобальний стейт провайдер

// Конфігурація Firebase з твого консолі
const firebaseConfig = {
  apiKey: "AIzaSyCzCfmUJ85-qgkn3aSsmBOSDFjagneUZZc",
  authDomain: "game-analytics-abe36.firebaseapp.com",
  projectId: "game-analytics-abe36",
  storageBucket: "game-analytics-abe36.firebasestorage.app",
  messagingSenderId: "510933334605",
  appId: "1:510933334605:web:544b10649f40f21316fa04",
  measurementId: "G-Q33WMDX02L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Дістаємо глобальний контекст. Якщо у твоєму сторі прописана функція логіну/оновлення — підв'язуємо її
  const { language } = useApp();
  const isUk = language === "uk";

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      // Крок 1: Відкриваємо вікно входу Google
      const result = await signInWithPopup(auth, googleProvider);
      
      // Крок 2: Отримуємо токен та базове ім'я користувача для інтерфейсу
      const idToken = await result.user.getIdToken();
      const displayName = result.user.displayName || "User";

      // Крок 3: Відправляємо токен на наш FastAPI бекенд через версійний префікс
      const response = await fetch(`${API_URL}/api/v1/auth/firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || (isUk ? 'Бекенд відхилив авторизацію Firebase.' : 'Backend rejected Firebase authorization.'));
      }

      // Крок 4: Записуємо сесію та ПРАВИЛЬНЕ ім'я в пам'ять браузера
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', displayName);
        
        // Переходимо на Дашборд без перезавантаження сторінки
        navigate('/');
      }

    } catch (err) {
      console.error("Помилка авторизації Google/Firebase:", err);
      setError(err.message || (isUk ? 'Сталася помилка під час входу через Google.' : 'An error occurred during Google Sign-In.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>NexusStats</h2>
        <p style={styles.subtitle}>
          {isUk ? "Мультиплатформна ігрова аналітика в один клік." : "Multiplatform gaming analytics in a single click."}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.buttonContainer}>
          <button 
            onClick={handleGoogleSignIn} 
            disabled={loading} 
            style={styles.googleBtn}
          >
            <span style={styles.icon}>🌐</span>
            {loading ? (isUk ? 'Авторизація...' : 'Authorizing...') : (isUk ? 'Увійти через Google' : 'Sign in with Google')}
          </button>
        </div>
        
        <p style={styles.footer}>
          {isUk ? "Без введення паролів, безпечно через Firebase Auth" : "No passwords required, secured by Firebase Auth"}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-main)', fontFamily: 'system-ui, sans-serif', color: 'var(--text-primary)' },
  card: { backgroundColor: 'var(--bg-card)', padding: '3rem 2.5rem', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', width: '100%', maxWidth: '420px', textAlign: 'center', border: '1px solid var(--border)' },
  title: { fontSize: '2.5rem', margin: '0 0 0.5rem 0', color: 'var(--accent)', fontWeight: '800', letterSpacing: '-0.05em' },
  subtitle: { color: 'var(--text-secondary)', margin: '0 0 2.5rem 0', fontSize: '1rem', lineHeight: '1.5' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  googleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' },
  icon: { fontSize: '1.3rem' },
  error: { backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' },
  footer: { marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }
};