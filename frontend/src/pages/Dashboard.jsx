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
    <div className="card" style={{ padding: "10px 14px" }}>
      <div style={{ color: "var(--text-bright)", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "var(--accent)" }}>{payload[0].value}h</div>
    </div>
  );
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePlatform, setActivePlatform] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Перевіряємо чи є підключення
      const connRes = await import("axios").then(m => m.default.get(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/debug/connection`));
      if (!connRes.data.steam_id) {
        setError("no_connection");
        return;
      }
      const res = await getOverview(activePlatform);
      setData(res.data);
    } catch {
      setError(t("common.error"));
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
      <h2 style={{ color: "var(--text-bright)" }}>Steam не підключено</h2>
      <p style={{ color: "var(--text-secondary)" }}>Підключіть Steam акаунт щоб побачити статистику</p>
      <button className="btn btn-primary" onClick={() => window.location.href = "/settings"}>
        Підключити Steam
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
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px 24px" }}>

      {/* Platform Filter */}
      {data?.platforms_breakdown?.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          <button className={`btn ${!activePlatform ? "btn-primary" : "btn-outline"}`}
            onClick={() => setActivePlatform(null)}>All</button>
          {data.platforms_breakdown.map(p => (
            <button key={p.platform}
              className={`btn ${activePlatform === p.platform ? "btn-primary" : "btn-outline"}`}
              onClick={() => setActivePlatform(p.platform)}>
              {p.platform === "steam" ? "🎮" : p.platform === "epic" ? "🟣" : "🟢"} {p.platform}
            </button>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <StatCard icon="🎮" title={t("dashboard.totalGames")} value={data?.total_games} color="var(--accent)" />
        <StatCard icon="⏱️" title={t("dashboard.totalHours")} value={`${data?.total_hours}h`} color="var(--accent-gold)" />
        <StatCard icon="🕐" title={t("dashboard.recentHours")} value={`${data?.recent_hours}h`} color="var(--accent-green)" />
        <StatCard icon="🏆" title={t("dashboard.achievements")}
          value={data?.total_achievements}
          subtitle={`${t("common.of")} ${data?.total_possible_achievements} (${data?.achievement_completion}%)`}
          color="var(--accent-purple)" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "24px" }}>
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
  );
}
