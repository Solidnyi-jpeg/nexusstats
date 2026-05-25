export default function StatCard({ icon, title, value, subtitle, color }) {
  return (
    <div className="card" style={{ padding: "20px 24px", display: "flex", gap: "16px", alignItems: "center" }}>
      <div style={{ fontSize: "2.2rem", width: "48px", textAlign: "center" }}>{icon}</div>
      <div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </div>
        <div style={{ color: color || "var(--accent)", fontSize: "1.8rem", fontWeight: "bold", lineHeight: 1.2 }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "2px" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
