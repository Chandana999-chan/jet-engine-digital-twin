import GlassCard from "./GlassCard";

export default function SensorCard({
  name,
  value,
  unit,
  label,
  icon,
}) {
  return (
    <GlassCard className="sensor-card">
      <div className="sensor-header">
        <div className="sensor-icon">{icon}</div>
        <span>{label}</span>
      </div>

      <div className="sensor-value">
        {value}
        <small>{unit}</small>
      </div>

      <div className="sensor-name">{name}</div>

      <div className="sensor-line">
        <span />
      </div>
    </GlassCard>
  );
}