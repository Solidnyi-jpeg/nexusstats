import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { connectWargaming, loginWargaming } from "../api";
import { useApp } from "../store";

export default function WGCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useApp();
  const uk = language === "uk";
  
  const [statusMsg, setStatusMsg] = useState(uk ? "Обробка даних Wargaming... ⏳" : "Processing Wargaming data... ⏳");

  useEffect(() => {
    const status = searchParams.get("status");
    if (status !== "ok") {
      setStatusMsg(uk ? "❌ Авторизацію скасовано" : "❌ Auth cancelled");
      setTimeout(() => navigate("/welcome"), 2000);
      return;
    }

    const data = {
      account_id: searchParams.get("account_id"),
      nickname: searchParams.get("nickname"),
    };

    const token = localStorage.getItem("token") || localStorage.getItem("access_token");

    // Функція, яка викликає логін з нуля
    const doLogin = () => {
      loginWargaming(data)
        .then((res) => {
          const newToken = res.data.access_token;
          localStorage.setItem("token", newToken); 
          localStorage.setItem("access_token", newToken); 
          setStatusMsg(uk ? "✅ Успішний вхід!" : "✅ Login successful!");
          setTimeout(() => window.location.replace("/"), 1000);
        })
        .catch(() => {
          setStatusMsg(uk ? "❌ Помилка входу в систему" : "❌ Login failed");
          setTimeout(() => navigate("/welcome"), 3000);
        });
    };

    if (token) {
      // Якщо токен є, пробуємо прив'язати платформу до поточного профілю
      connectWargaming(data)
        .then(() => {
          setStatusMsg(uk ? "✅ Wargaming успішно підключено!" : "✅ Connected successfully!");
          setTimeout(() => window.location.replace("/settings"), 1500);
        })
        .catch((err) => {
          // ОСЬ ГОЛОВНИЙ ФІКС: Якщо бекенд каже 401 (токен застарів)
          if (err.response && err.response.status === 401) {
            console.warn("Токен застарів. Виконуємо вхід як новий користувач...");
            localStorage.removeItem("token");
            localStorage.removeItem("access_token");
            doLogin(); // Запускаємо звичайний логін
          } else {
            setStatusMsg(uk ? "❌ Помилка прив'язки акаунта" : "❌ Error connecting account");
            setTimeout(() => navigate("/settings"), 3000);
          }
        });
    } else {
      // Якщо токена від самого початку немає — логінимось
      doLogin();
    }
  }, [searchParams, navigate, uk]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg-main)" }}>
      <div className="card" style={{ padding: 40, textAlign: "center", minWidth: 320 }}>
        <h2 style={{ color: "var(--text-bright)", margin: 0, fontSize: "1.2rem" }}>{statusMsg}</h2>
      </div>
    </div>
  );
}