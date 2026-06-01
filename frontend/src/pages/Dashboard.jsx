import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { getOverview } from "../api";
import StatCard from "../components/StatCard";
import GameRow from "../components/GameRow";

const COLORS = ["#66c0f4","#4caf50","#f8c63a","#ef5350","#ab47bc","#26c6da","#d4e157","#ff7043","#42a5f5","#26a69a"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div style={{ color: "var(--text-bright)", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "var(--accent)" }}>{payload[0].value}h</div>
    </div>
  );
};

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const isUk = i18n.language === "uk";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePlatform, setActivePlatform] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem("token");
      if (!token) {
        setError("no_connection");
        return;
      }

      const response = await fetch(`http://localhost:8000/api/v1/analytics/overview${activePlatform ? `?platform=${activePlatform}` : ''}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (response.status === 401) {
        setError("no_connection");
        return;
      }

      if (!response.ok) throw new Error();

      const resData = await response.json();
      if (!resData || resData.total_games === 0) {
        setError("no_connection");
        return;
      }
      setData(resData);
    } catch {
      setError(t("common.error") || (isUk ? "Сталася помилка" : "An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activePlatform]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "3rem" }}>🎮</div>
      <div style={{ color: "var(--accent)" }}>{t("common.loading")}</div>
    </div>
  );

  if (error === "no_connection") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "4rem" }}>🎮</div>
      <h2 style={{ color: "var(--text-bright)" }}>{isUk ? "Steam не підключено" : "Steam not connected"}</h2>
      <p style={{ color: "var(--text-secondary)" }}>{isUk ? "Підключіть Steam акаунт щоб побачити статистику" : "Connect your Steam account to see statistics"}</p>
      <button className="btn btn-primary" onClick={() => window.location.href = "/settings"}>
        {isUk ? "Підключити Steam" : "Connect Steam"}
      </button>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "3rem" }}>⚠️</div>
      <div style={{ color: "var(--accent-red)" }}>{error}</div>
      <button className="btn btn-primary" onClick={fetchData}>{t("common.retry")}</button>
    </div>
  );

  const chartData = data?.top_games?.slice(0, 8).map(g => ({
    name: g.name.length > 12 ? g.name.slice(0, 12) + "…" : g.name,
    fullName: g.name,
    hours: g.playtime_hours,
  })) || [];

  const platformData = data?.platforms_breakdown?.map(p => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    value: p.hours,
    games: p.games,
  })) || [];

  return (
    <div style={{ display: "flex", maxWidth: "1600px", margin: "0 auto", padding: "24px", gap: "24px", alignItems: "flex-start" }}>
      
      {/* 🛠️ ЛІВА БІЧНА ПАНЕЛЬ ФІЛЬТРАЦІЇ ПЛАТФОРМ */}
      <div className="card" style={{ width: "260px", padding: "20px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px", position: "sticky", top: "84px" }}>
        <h4 style={{ color: "var(--text-bright)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
          🔌 {isUk ? "Вибір платформи" : "Filter Platform"}
        </h4>
        
        <button 
          className={`btn ${!activePlatform ? "btn-primary" : "btn-outline"}`}
          style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => setActivePlatform(null)}
        >
          🌐 <span>{isUk ? "Усі платформи" : "All Platforms"}</span>
        </button>

        {data?.platforms_breakdown?.map(p => (
          <button 
            key={p.platform}
            className={`btn ${activePlatform === p.platform ? "btn-primary" : "btn-outline"}`}
            style={{ justifyContent: "flex-start", width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", textTransform: "capitalize" }}
            onClick={() => setActivePlatform(p.platform)}
          >
            <span>{p.platform === "steam" ? "🎮" : p.platform === "epic" ? "🟣" : " green 🟢"}</span>
            <span>{p.platform}</span>
          </button>
        ))}
      </div>

      {/* ОСНОВНА КОНТЕНТНА ЗОНА ДАШБОРДУ */}
      <div style={{ flex: 1, minWidth: 0 }}>
        
        {/* Stat Cards (Повернуто оригінальний recentHours замість дорогої ціни) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <StatCard icon="🎮" title={t("dashboard.totalGames") || "Усього ігор"} value={data?.total_games} color="var(--accent)" />
          <StatCard icon="⏱️" title={t("dashboard.totalHours") || "Загальний час"} value={`${data?.total_hours}h`} color="var(--accent-gold)" />
          <StatCard icon="🕐" title={t("dashboard.recentHours") || "Нещодавній час"} value={`${data?.recent_hours}h`} color="var(--accent-green)" />
          <StatCard icon="🏆" title={t("dashboard.achievements") || "Досягнення"}
            value={data?.total_achievements}
            subtitle={`${t("common.of") || "з"} ${data?.total_possible_achievements} (${data?.achievement_completion}%)`}
            color="var(--accent-purple)" />
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ color: "var(--text-bright)", marginBottom: "20px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("dashboard.topGames")}
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ left: -10 }}>
                <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ color: "var(--text-bright)", marginBottom: "20px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("dashboard.platforms")}
            </h3>
            {platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={platformData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value">
                    {platformData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val, name) => [`${val}h`, name]}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)" }} />
                  <Legend formatter={v => <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "260px", color: "var(--text-secondary)" }}>
                No platforms connected
              </div>
            )}
          </div>
        </div>

        {/* Game Lists */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ color: "var(--text-bright)", marginBottom: "16px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🏆 {t("dashboard.topGames")}
            </h3>
            {data?.top_games?.map((g, i) => <GameRow key={g.game_id} game={g} rank={i + 1} />)}
          </div>

          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ color: "var(--text-bright)", marginBottom: "16px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🕐 {t("dashboard.recentGames")}
            </h3>
            {data?.recent_games?.length > 0
              ? data.recent_games.map((g, i) => <GameRow key={g.game_id} game={g} rank={i + 1} />)
              : <div style={{ color: "var(--text-secondary)", padding: "20px 0" }}>{t("dashboard.noRecent")}</div>
            }
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <button className="btn btn-outline" onClick={fetchData}>🔄 {t("common.refresh")}</button>
        </div>

      </div>
    </div>
  );
}