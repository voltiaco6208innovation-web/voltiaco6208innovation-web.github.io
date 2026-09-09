/**
 * AEROVOLT — Mapa Modbus por defecto (plantilla inversor genérico)
 * Ajustar addresses según manual del fabricante / PLC de planta.
 */
window.AEROVOLT_MODBUS_MAP = {
  version: '1.0.0',
  profile: 'generic-inverter-v1',
  note: 'Plantilla. Reemplazar por mapa real del equipo antes de FIELD.',
  defaults: { port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 4000 },
  emergency: {
    type: 'coil',
    address: 0,
    value: true,
    description: 'Coil de trip / apagado de emergencia'
  },
  devices: [
    {
      id: 'INV-01',
      name: 'Inversor 01',
      plantId: 'PLT-001',
      unitId: 1,
      host: '192.168.10.11',
      registers: [
        { key: 'power_kw', type: 'holding', address: 100, scale: 0.1, offset: 0, unit: 'kW' },
        { key: 'dc_v', type: 'holding', address: 101, scale: 0.1, offset: 0, unit: 'V' },
        { key: 'dc_a', type: 'holding', address: 102, scale: 0.1, offset: 0, unit: 'A' },
        { key: 'ac_v', type: 'holding', address: 103, scale: 0.1, offset: 0, unit: 'V' },
        { key: 'ac_a', type: 'holding', address: 104, scale: 0.1, offset: 0, unit: 'A' },
        { key: 'freq', type: 'holding', address: 105, scale: 0.01, offset: 0, unit: 'Hz' },
        { key: 'status_code', type: 'holding', address: 110, scale: 1, offset: 0, unit: 'code' },
        { key: 'alarm_code', type: 'holding', address: 111, scale: 1, offset: 0, unit: 'code' }
      ]
    },
    {
      id: 'INV-02',
      name: 'Inversor 02',
      plantId: 'PLT-001',
      unitId: 2,
      host: '192.168.10.12',
      registers: [
        { key: 'power_kw', type: 'holding', address: 100, scale: 0.1, offset: 0, unit: 'kW' },
        { key: 'dc_v', type: 'holding', address: 101, scale: 0.1, offset: 0, unit: 'V' },
        { key: 'status_code', type: 'holding', address: 110, scale: 1, offset: 0, unit: 'code' }
      ]
    },
    {
      id: 'INV-04',
      name: 'Inversor 04',
      plantId: 'PLT-001',
      unitId: 4,
      host: '192.168.10.14',
      registers: [
        { key: 'power_kw', type: 'holding', address: 100, scale: 0.1, offset: 0, unit: 'kW' },
        { key: 'status_code', type: 'holding', address: 110, scale: 1, offset: 0, unit: 'code' },
        { key: 'alarm_code', type: 'holding', address: 111, scale: 1, offset: 0, unit: 'code' }
      ]
    }
  ],
  statusCodes: { 0: 'NORMAL', 1: 'ADVERTENCIA', 2: 'FALLA', 3: 'CRITICO', 9: 'OFFLINE' }
};
