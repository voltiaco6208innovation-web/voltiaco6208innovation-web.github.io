/**
 * AEROVOLT HMO — Datos de demostración (FASE TEST)
 * NUNCA presentar como datos reales de campo.
 * Estructura preparada para sustituir por API/MQTT real.
 */
window.AEROVOLT = window.AEROVOLT || {};

AEROVOLT.DEMO = true;
AEROVOLT.DEMO_LABEL = 'DEMO · FASE TEST · Datos simulados';

AEROVOLT.plants = [
  {
    id: 'PLT-001',
    name: 'Planta Norte Culiacán',
    location: 'Culiacán, Sinaloa',
    capacity_kw: 500,
    status: 'NORMAL',
    sectors: ['Sector A', 'Sector B']
  },
  {
    id: 'PLT-002',
    name: 'Planta Industrial HMO',
    location: 'Hermosillo, Sonora',
    capacity_kw: 1200,
    status: 'ADVERTENCIA',
    sectors: ['Zona 1', 'Zona 2', 'Zona 3']
  }
];

AEROVOLT.inverters = [
  { id: 'INV-01', plantId: 'PLT-001', sector: 'Sector A', name: 'Inversor 01', status: 'NORMAL', expected_kw: 82, power_kw: 78.4, dc_v: 612, dc_a: 128, ac_v: 480, ac_a: 94, energy_kwh: 412.3, freq: 60.01, pf: 0.98, last_comm_s: 3, alarm: null },
  { id: 'INV-02', plantId: 'PLT-001', sector: 'Sector A', name: 'Inversor 02', status: 'NORMAL', expected_kw: 82, power_kw: 80.1, dc_v: 608, dc_a: 131, ac_v: 479, ac_a: 96, energy_kwh: 425.8, freq: 60.00, pf: 0.99, last_comm_s: 2, alarm: null },
  { id: 'INV-03', plantId: 'PLT-001', sector: 'Sector B', name: 'Inversor 03', status: 'NORMAL', expected_kw: 82, power_kw: 76.9, dc_v: 615, dc_a: 125, ac_v: 481, ac_a: 92, energy_kwh: 398.1, freq: 59.99, pf: 0.97, last_comm_s: 4, alarm: null },
  { id: 'INV-04', plantId: 'PLT-001', sector: 'Sector B', name: 'Inversor 04', status: 'FALLA', expected_kw: 82, power_kw: 43.2, dc_v: 610, dc_a: 71, ac_v: 480, ac_a: 52, energy_kwh: 210.5, freq: 60.02, pf: 0.95, last_comm_s: 4, alarm: 'Producción inferior a esperada' },
  { id: 'INV-05', plantId: 'PLT-001', sector: 'Sector B', name: 'Inversor 05', status: 'ADVERTENCIA', expected_kw: 82, power_kw: 61.0, dc_v: 590, dc_a: 103, ac_v: 478, ac_a: 73, energy_kwh: 305.2, freq: 60.01, pf: 0.96, last_comm_s: 5, alarm: 'Desviación moderada de potencia' },
  { id: 'INV-06', plantId: 'PLT-002', sector: 'Zona 1', name: 'Inversor 06', status: 'NORMAL', expected_kw: 100, power_kw: 96.2, dc_v: 720, dc_a: 134, ac_v: 480, ac_a: 115, energy_kwh: 520.0, freq: 60.00, pf: 0.99, last_comm_s: 2, alarm: null },
  { id: 'INV-07', plantId: 'PLT-002', sector: 'Zona 2', name: 'Inversor 07', status: 'ADVERTENCIA', expected_kw: 100, power_kw: 58.0, dc_v: 705, dc_a: 82, ac_v: 479, ac_a: 70, energy_kwh: 310.4, freq: 60.01, pf: 0.94, last_comm_s: 6, alarm: 'Producción significativamente por debajo de lo esperado' },
  { id: 'INV-08', plantId: 'PLT-002', sector: 'Zona 3', name: 'Inversor 08', status: 'CRITICO', expected_kw: 100, power_kw: 0, dc_v: 0, dc_a: 0, ac_v: 0, ac_a: 0, energy_kwh: 0, freq: 0, pf: 0, last_comm_s: 180, alarm: 'Sin comunicación · Offline' }
];

AEROVOLT.env = {
  irradiance: 910,
  module_temp: 48.2,
  ambient_temp: 31.0,
  wind_speed: 4.2,
  wind_dir: 220,
  rain_mm: 0,
  humidity: 42,
  soiling_index: 0.08
};

AEROVOLT.alarms = [
  { id: 'ALM-001', equipmentId: 'INV-04', plantId: 'PLT-001', level: 'FALLA', message: 'Producción inferior a esperada', value: 43.2, expected: 82, unit: 'kW', ts: '2026-09-04T18:12:00Z', status: 'ABIERTA' },
  { id: 'ALM-002', equipmentId: 'INV-05', plantId: 'PLT-001', level: 'ADVERTENCIA', message: 'Desviación moderada de potencia', value: 61.0, expected: 82, unit: 'kW', ts: '2026-09-04T17:45:00Z', status: 'ABIERTA' },
  { id: 'ALM-003', equipmentId: 'INV-07', plantId: 'PLT-002', level: 'ADVERTENCIA', message: 'Producción significativamente por debajo de lo esperado', value: 58.0, expected: 100, unit: 'kW', ts: '2026-09-04T16:30:00Z', status: 'ABIERTA' },
  { id: 'ALM-004', equipmentId: 'INV-08', plantId: 'PLT-002', level: 'CRITICO', message: 'Sin comunicación · Offline', value: null, expected: null, unit: null, ts: '2026-09-04T15:02:00Z', status: 'ABIERTA' },
  { id: 'ALM-005', equipmentId: 'INV-02', plantId: 'PLT-001', level: 'NORMAL', message: 'Recuperación de rendimiento', value: 80.1, expected: 82, unit: 'kW', ts: '2026-09-04T14:10:00Z', status: 'CERRADA' }
];

AEROVOLT.history = [
  { ts: '2026-09-04T18:12:00Z', type: 'ALARMA', equipmentId: 'INV-04', detail: 'Estado → FALLA' },
  { ts: '2026-09-04T17:45:00Z', type: 'ALARMA', equipmentId: 'INV-05', detail: 'Estado → ADVERTENCIA' },
  { ts: '2026-09-04T16:30:00Z', type: 'ALARMA', equipmentId: 'INV-07', detail: 'Estado → ADVERTENCIA' },
  { ts: '2026-09-04T15:02:00Z', type: 'COMMS', equipmentId: 'INV-08', detail: 'Pérdida de comunicación' },
  { ts: '2026-09-04T12:00:00Z', type: 'SISTEMA', equipmentId: null, detail: 'Snapshot diario generado' },
  { ts: '2026-09-04T08:15:00Z', type: 'ESTADO', equipmentId: 'INV-01', detail: 'Arranque normal' }
];

AEROVOLT.calcPR = function (inv) {
  if (!inv.expected_kw || inv.expected_kw === 0) return 0;
  return Math.round((inv.power_kw / inv.expected_kw) * 100);
};

AEROVOLT.statusColor = function (status) {
  const map = {
    NORMAL: '#00ff9d',
    ADVERTENCIA: '#f5c542',
    FALLA: '#ff8c42',
    CRITICO: '#ff3b5c'
  };
  return map[status] || '#8b9bb8';
};

AEROVOLT.statusEmoji = function (status) {
  const map = { NORMAL: '🟢', ADVERTENCIA: '🟡', FALLA: '🟠', CRITICO: '🔴' };
  return map[status] || '⚪';
};

AEROVOLT.tick = function () {
  AEROVOLT.inverters.forEach(inv => {
    if (inv.status === 'CRITICO') return;
    const noise = (Math.random() - 0.5) * 1.5;
    inv.power_kw = Math.max(0, +(inv.power_kw + noise).toFixed(1));
    inv.last_comm_s = Math.max(1, inv.last_comm_s + Math.floor(Math.random() * 2) - 1);
  });
  AEROVOLT.env.irradiance = Math.max(0, Math.round(AEROVOLT.env.irradiance + (Math.random() - 0.5) * 20));
  AEROVOLT.env.ambient_temp = +(AEROVOLT.env.ambient_temp + (Math.random() - 0.5) * 0.3).toFixed(1);
};
