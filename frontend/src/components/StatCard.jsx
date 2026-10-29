import GlassCard from "./GlassCard";

export default function StatCard({
  title,
  value,
  unit,
  change,
  icon,
  status,
}) {
  return (
    <GlassCard className="stat-card">
      <div className="stat-top">
        <span>{title}</span>

        <div className="stat-icon">{icon}</div>
      </div>

      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>

      <div className={`stat-change ${status || ""}`}>
        {change}
      </div>
    </GlassCard>
  );
}