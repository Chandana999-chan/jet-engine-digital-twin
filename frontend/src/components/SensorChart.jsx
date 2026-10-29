import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import GlassCard from "./GlassCard";

export default function SensorChart({ data = [] }) {
  const chartData = Array.isArray(data)
    ? data
        .map((item) => {
          const sensors = item?.sensors || {};

          return {
            cycle: Number(item?.cycle ?? 0),

            sensor11:
              Number(sensors.sensor_11 ?? 0),

            sensor9:
              Number(sensors.sensor_9 ?? 0),

            sensor4:
              Number(sensors.sensor_4 ?? 0),

            sensor7:
              Number(sensors.sensor_7 ?? 0),

            sensor12:
              Number(sensors.sensor_12 ?? 0),
          };
        })
        .filter(
          (item) =>
            Number.isFinite(item.cycle) &&
            item.cycle > 0
        )
    : [];

  return (
    <GlassCard>
      <div className="sensor-chart">

        <div className="sensor-chart-header">
          <div>
            <span className="eyebrow">
              REAL-TIME TELEMETRY
            </span>

            <h2>Engine Performance</h2>
          </div>

          <span className="data-source">
            C-MAPSS SENSORS
          </span>
        </div>

        <div
          className="sensor-chart-container"
          style={{
            width: "100%",
            height: "320px",
          }}
        >
          {chartData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 0,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.15}
                />

                <XAxis
                  dataKey="cycle"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Cycle",
                    position: "insideBottom",
                    offset: -5,
                  }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="sensor11"
                  name="Sensor 11"
                  strokeWidth={2}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="sensor9"
                  name="Sensor 9"
                  strokeWidth={2}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="sensor4"
                  name="Sensor 4"
                  strokeWidth={2}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="sensor7"
                  name="Sensor 7"
                  strokeWidth={2}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="sensor12"
                  name="Sensor 12"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Loading telemetry...
            </div>
          )}
        </div>

      </div>
    </GlassCard>
  );
}