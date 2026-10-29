export const mockDashboardData = {
  engine: {
    id: "ENG-001",
    status: "NORMAL",
    health: 92,
    rul: 47,
    failureRisk: 18,
    operatingHours: 2847,
    cycles: 14382,
  },

  sensors: {
    temperature: 642.3,
    pressure: 1589.7,
    vibration: 0.42,
    speed: 8500,
    fuelFlow: 2.84,
    oilPressure: 74.2,
  },

  acoustic: {
    status: "NORMAL",
    confidence: 94,
    faultType: "No anomaly detected",
    noiseLevel: 42,
  },

  alerts: [
    {
      id: 1,
      severity: "warning",
      title: "Temperature approaching threshold",
      message: "Exhaust temperature increased by 4.2% over baseline.",
      time: "2 min ago",
    },
    {
      id: 2,
      severity: "info",
      title: "Routine monitoring active",
      message: "All primary engine parameters are within expected range.",
      time: "8 min ago",
    },
  ],

  history: [
    { time: "10:00", temperature: 624, pressure: 1540, rul: 51 },
    { time: "10:10", temperature: 629, pressure: 1552, rul: 50 },
    { time: "10:20", temperature: 631, pressure: 1561, rul: 49 },
    { time: "10:30", temperature: 637, pressure: 1570, rul: 49 },
    { time: "10:40", temperature: 635, pressure: 1578, rul: 48 },
    { time: "10:50", temperature: 642, pressure: 1584, rul: 47 },
    { time: "11:00", temperature: 642, pressure: 1589, rul: 47 },
  ],

  xai: [
    { feature: "Sensor 11", value: 0.42 },
    { feature: "Sensor 4", value: 0.31 },
    { feature: "Temperature", value: 0.24 },
    { feature: "MFCC-3", value: 0.18 },
    { feature: "Pressure", value: 0.13 },
  ],
};