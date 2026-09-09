/** AEROVOLT O&M — modelo de datos centralizado (source: DEMO) */
(function (g) {
  const SOURCE = 'DEMO';

  const organizations = [
    { id: 'ORG-001', name: 'Aerovolt Demo Client', plants: ['PLT-001', 'PLT-002'] }
  ];

  const plants = [
    { id: 'PLT-001', orgId: 'ORG-001', name: 'Norte Culiacán', capacityMWp: 5.2, sectors: ['A', 'B', 'C', 'D'] },
    { id: 'PLT-002', orgId: 'ORG-001', name: 'Industrial HMO', capacityMWp: 3.8, sectors: ['A', 'B', 'C'] }
  ];

  function inv(id, plantId, sector, power, expected, status, temp) {
    const pr = expected > 0 ? +((power / expected) * 100).toFixed(1) : 0;
    const daily = +(power * 5.9).toFixed(1);
    return {
      id: id, plantId: plantId, sector: sector, type: 'INVERTER',
      power_kw: power, expected_kw: expected, pr: pr,
      dc_v: 610 + Math.round(Math.random() * 40),
      dc_a: +(power * 1000 / 620 * (0.9 + Math.random() * 0.1)).toFixed(1),
      ac_v: 480 + Math.round(Math.random() * 8),
      ac_a: +(power * 1000 / 480 / 1.73).toFixed(1),
      ac_power_kw: +(power * 0.97).toFixed(1),
      freq: 60.0, pf: 0.99,
      temp_c: temp,
      efficiency: +(96 + Math.random() * 2).toFixed(1),
      status: status,
      comm: status === 'OFFLINE' ? 'OFFLINE' : status === 'FAULT' ? 'DEGRADED' : 'ONLINE',
      last_comm_s: status === 'OFFLINE' ? 180 : Math.round(Math.random() * 8),
      latency_ms: status === 'OFFLINE' ? null : 20 + Math.round(Math.random() * 40),
      packet_loss: status === 'OFFLINE' ? 100 : status === 'FAULT' ? 4.2 : 0.3,
      protocol: 'Modbus TCP',
      gateway: 'GW-' + plantId.slice(-3),
      signal: status === 'OFFLINE' ? 0 : 70 + Math.round(Math.random() * 25),
      daily_energy_kwh: daily,
      monthly_energy_kwh: +(daily * 22).toFixed(0),
      cumulative_energy_mwh: +(1200 + Math.random() * 400).toFixed(1),
      availability: status === 'OFFLINE' ? 0 : status === 'FAULT' ? 91 : 99.2,
      alarm: status === 'FAULT' ? 'Overtemperature / production deviation' : status === 'WARNING' ? 'Elevated temp' : null,
      source: SOURCE
    };
  }

  const equipment = [
    inv('INV-01', 'PLT-001', 'A', 312, 320, 'NORMAL', 42),
    inv('INV-02', 'PLT-001', 'A', 308, 318, 'NORMAL', 41),
    inv('INV-03', 'PLT-001', 'A', 315, 322, 'NORMAL', 43),
    inv('INV-04', 'PLT-001', 'A', 301, 315, 'NORMAL', 44),
    inv('INV-05', 'PLT-001', 'B', 298, 318, 'WARNING', 52),
    inv('INV-06', 'PLT-001', 'B', 310, 320, 'NORMAL', 45),
    inv('INV-07', 'PLT-001', 'B', 245, 318, 'FAULT', 61),
    inv('INV-08', 'PLT-001', 'B', 268, 315, 'DEGRADED', 55),
    inv('INV-09', 'PLT-001', 'C', 305, 318, 'NORMAL', 42),
    inv('INV-10', 'PLT-001', 'C', 300, 316, 'NORMAL', 43),
    inv('INV-11', 'PLT-001', 'C', 290, 314, 'WARNING', 50),
    inv('INV-12', 'PLT-001', 'C', 307, 319, 'NORMAL', 41),
    inv('INV-13', 'PLT-001', 'D', 0, 318, 'OFFLINE', null),
    inv('INV-14', 'PLT-001', 'D', 302, 317, 'NORMAL', 42),
    inv('INV-15', 'PLT-001', 'D', 299, 316, 'NORMAL', 43),
    inv('INV-16', 'PLT-001', 'D', 304, 318, 'NORMAL', 42),
    inv('INV-21', 'PLT-002', 'A', 280, 290, 'NORMAL', 40),
    inv('INV-22', 'PLT-002', 'A', 275, 288, 'NORMAL', 41),
    inv('INV-23', 'PLT-002', 'B', 260, 285, 'WARNING', 48),
    inv('INV-24', 'PLT-002', 'C', 270, 286, 'NORMAL', 42)
  ];

  // alias
  const inverters = equipment;

  const env = {
    plantId: 'PLT-001',
    irradiance: 852, module_temp: 48.2, ambient_temp: 34.1,
    wind_speed: 3.2, wind_dir: 'SW', humidity: 42,
    rain_mm: 0, rain_acc_mm: 12.4, soiling_index: 0.18,
    cloud_cover: 15, solar_elevation: 62, forecast: 'Despejado · irradiancia alta',
    source: SOURCE
  };

  const incidents = [
    { id: 'INC-1042', time: '2026-09-09T12:48:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'INV-07', type: 'OVER TEMPERATURE', severity: 'CRITICAL', status: 'NEW', description: 'Temp 9.8°C over sector avg', possibleCause: 'Ventilation / thermal derating', recommendedAction: 'Inspect INV-07 cooling', assignedTo: null, acknowledgedAt: null, resolvedAt: null, closedAt: null, closed: false, energyLoss_kWh: 184, source: SOURCE },
    { id: 'INC-1041', time: '2026-09-09T12:41:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'INV-08', type: 'PRODUCTION DEVIATION', severity: 'HIGH', status: 'ACKNOWLEDGED', description: 'Power below expected', possibleCause: 'Partial derating', recommendedAction: 'Compare strings', assignedTo: 'op.ramos', acknowledgedAt: '2026-09-09T12:45:00Z', resolvedAt: null, closedAt: null, closed: false, energyLoss_kWh: 96, source: SOURCE },
    { id: 'INC-1040', time: '2026-09-09T11:20:00Z', plantId: 'PLT-001', sector: 'D', equipment: 'INV-13', type: 'COMMUNICATION FAILURE', severity: 'CRITICAL', status: 'INVESTIGATING', description: 'No packets 180s', possibleCause: 'Gateway / network', recommendedAction: 'Check GW and cabling', assignedTo: 'tech.luna', acknowledgedAt: '2026-09-09T11:25:00Z', resolvedAt: null, closedAt: null, closed: false, energyLoss_kWh: 420, source: SOURCE },
    { id: 'INC-1038', time: '2026-09-09T09:05:00Z', plantId: 'PLT-001', sector: 'C', equipment: 'INV-11', type: 'OVER TEMPERATURE', severity: 'MEDIUM', status: 'IN PROGRESS', description: 'Elevated temperature', possibleCause: 'Ambient + load', recommendedAction: 'Monitor trend', assignedTo: 'tech.luna', acknowledgedAt: '2026-09-09T09:10:00Z', resolvedAt: null, closedAt: null, closed: false, energyLoss_kWh: 22, source: SOURCE },
    { id: 'INC-1035', time: '2026-09-08T16:12:00Z', plantId: 'PLT-001', sector: 'A', equipment: 'SENSOR-IRR-01', type: 'SENSOR FAILURE', severity: 'MEDIUM', status: 'CLOSED', description: 'Irradiance sensor drift', possibleCause: 'Dirty sensor', recommendedAction: 'Cleaned', assignedTo: 'tech.luna', acknowledgedAt: '2026-09-08T16:15:00Z', resolvedAt: '2026-09-08T17:00:00Z', closedAt: '2026-09-08T17:05:00Z', closed: true, energyLoss_kWh: 0, source: SOURCE },
    { id: 'INC-1031', time: '2026-09-08T08:00:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'SECTOR-B', type: 'SOILING', severity: 'HIGH', status: 'CLOSED', description: 'Excessive soiling', possibleCause: 'Dust event', recommendedAction: 'Priority cleaning', assignedTo: 'om.manager', acknowledgedAt: '2026-09-08T08:10:00Z', resolvedAt: '2026-09-08T14:00:00Z', closedAt: '2026-09-08T15:00:00Z', closed: true, energyLoss_kWh: 310, source: SOURCE }
  ];

  const workOrders = [
    { id: 'WO-2201', type: 'CORRECTIVE', equipment: 'INV-07', plantId: 'PLT-001', sector: 'B', status: 'OPEN', technician: null, priority: 'CRITICAL', createdAt: '2026-09-09T12:50:00Z', notes: 'From INC-1042', parts: [], cost: 0, downtime_h: 0, source: SOURCE },
    { id: 'WO-2198', type: 'INSPECTION', equipment: 'INV-13', plantId: 'PLT-001', sector: 'D', status: 'ASSIGNED', technician: 'tech.luna', priority: 'HIGH', createdAt: '2026-09-09T11:30:00Z', notes: 'Comm check', parts: [], cost: 0, downtime_h: 2, source: SOURCE },
    { id: 'WO-2190', type: 'CLEANING', equipment: 'SECTOR-B', plantId: 'PLT-001', sector: 'B', status: 'COMPLETED', technician: 'crew.norte', priority: 'HIGH', createdAt: '2026-09-08T08:30:00Z', notes: 'Priority clean', parts: [], cost: 4500, downtime_h: 0, source: SOURCE },
    { id: 'WO-2185', type: 'PREVENTIVE', equipment: 'INV-01', plantId: 'PLT-001', sector: 'A', status: 'CLOSED', technician: 'tech.luna', priority: 'LOW', createdAt: '2026-09-01T09:00:00Z', notes: 'Quarterly', parts: ['filter'], cost: 800, downtime_h: 1, source: SOURCE }
  ];

  const events = [
    { ts: '2026-09-09T12:48:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'INV-07', event: 'ALARM_RAISED', severity: 'CRITICAL', status: 'NEW', user: 'system', category: 'ALARMS', source: SOURCE },
    { ts: '2026-09-09T12:45:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'INV-08', event: 'ALARM_ACK', severity: 'HIGH', status: 'ACKNOWLEDGED', user: 'op.ramos', category: 'ALARMS', source: SOURCE },
    { ts: '2026-09-09T11:30:00Z', plantId: 'PLT-001', sector: 'D', equipment: 'INV-13', event: 'WO_CREATED', severity: 'HIGH', status: 'ASSIGNED', user: 'op.ramos', category: 'MAINTENANCE', source: SOURCE },
    { ts: '2026-09-09T10:00:00Z', plantId: 'PLT-001', sector: 'A', equipment: 'INV-01', event: 'COMM_OK', severity: 'LOW', status: 'OK', user: 'system', category: 'COMMUNICATION', source: SOURCE },
    { ts: '2026-09-09T08:15:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'SECTOR-B', event: 'PR_DEVIATION', severity: 'MEDIUM', status: 'OPEN', user: 'system', category: 'PERFORMANCE', source: SOURCE },
    { ts: '2026-09-08T17:05:00Z', plantId: 'PLT-001', sector: 'A', equipment: 'SENSOR-IRR-01', event: 'INCIDENT_CLOSED', severity: 'MEDIUM', status: 'CLOSED', user: 'tech.luna', category: 'ALARMS', source: SOURCE }
  ];

  function plantKpis(plantId) {
    const list = equipment.filter(function (i) { return i.plantId === plantId; });
    const power = list.reduce(function (s, i) { return s + i.power_kw; }, 0);
    const expected = list.reduce(function (s, i) { return s + i.expected_kw; }, 0);
    const online = list.filter(function (i) { return i.comm === 'ONLINE' || i.comm === 'DEGRADED'; }).length;
    const todayEnergy = +(power * 5.9).toFixed(2);
    const expectedEnergy = +(expected * 5.9).toFixed(2);
    const loss = +(expectedEnergy - todayEnergy).toFixed(2);
    const pr = expected > 0 ? +((power / expected) * 100).toFixed(1) : 0;
    const avail = list.length ? +((online / list.length) * 100).toFixed(1) : 0;
    const plant = plants.find(function (p) { return p.id === plantId; });
    const yieldSpec = plant ? +(todayEnergy / plant.capacityMWp).toFixed(2) : 0;
    const co2 = +(todayEnergy * 0.42 / 1000).toFixed(2);
    return {
      outputMW: +(power / 1000).toFixed(2),
      todayEnergyMWh: +(todayEnergy / 1000).toFixed(2),
      expectedMWh: +(expectedEnergy / 1000).toFixed(2),
      lossMWh: +(loss / 1000).toFixed(2),
      pr: pr, availability: avail, specificYield: yieldSpec, co2_t: co2,
      power_kw: +power.toFixed(1), expected_kw: +expected.toFixed(1),
      deviationPct: expected > 0 ? +(((expected - power) / expected) * 100).toFixed(1) : 0,
      source: SOURCE
    };
  }

  function measurements(plantId, hours) {
    const base = plantKpis(plantId).power_kw;
    const labels = []; const dc = []; const ac = []; const exp = []; const irr = []; const act = []; const expP = [];
    hours = hours || 12;
    for (let i = 0; i < hours; i++) {
      const h = 6 + i * (12 / Math.max(hours - 1, 1));
      labels.push(String(Math.floor(h)).padStart(2, '0') + ':00');
      const factor = Math.max(0, Math.sin((i / hours) * Math.PI));
      const noise = 0.92 + Math.random() * 0.08;
      const e = base * factor;
      const a = e * noise * (i > hours * 0.55 && i < hours * 0.7 ? 0.88 : 1);
      dc.push(+e.toFixed(1)); ac.push(+(a * 0.97).toFixed(1)); exp.push(+e.toFixed(1));
      irr.push(Math.round(200 + 750 * factor));
      act.push(+(a / 1000).toFixed(3)); expP.push(+(e / 1000).toFixed(3));
    }
    return { labels: labels, dc: dc, ac: ac, expected: exp, irr: irr, actualMWh: act, expectedMWh: expP, source: SOURCE };
  }

  function matrix(plantId) {
    const list = equipment.filter(function (i) { return i.plantId === plantId; });
    const sectors = {};
    list.forEach(function (i) {
      if (!sectors[i.sector]) sectors[i.sector] = [];
      sectors[i.sector].push(i);
    });
    return sectors;
  }

  function statusColor(st) {
    if (st === 'NORMAL') return { key: 'ok', label: 'NORMAL', emoji: '🟢' };
    if (st === 'WARNING') return { key: 'warn', label: 'WARNING', emoji: '🟡' };
    if (st === 'DEGRADED') return { key: 'deg', label: 'DEGRADED', emoji: '🟠' };
    if (st === 'FAULT' || st === 'CRITICAL') return { key: 'fault', label: st, emoji: '🔴' };
    return { key: 'off', label: 'OFFLINE', emoji: '⚫' };
  }

  function jarvisInsight(plantId) {
    const k = plantKpis(plantId);
    const bad = equipment.filter(function (i) {
      return i.plantId === plantId && (i.status === 'FAULT' || i.status === 'DEGRADED' || i.status === 'OFFLINE');
    });
    if (!bad.length) {
      return { text: 'Operación estable. PR ' + k.pr + '%. Sin desviaciones críticas.', impact: '0 kWh', rec: 'Continuar monitoreo.', source: SOURCE, mode: 'RULE_ENGINE_DEMO' };
    }
    const top = bad.sort(function (a, b) { return a.power_kw - b.power_kw; })[0];
    return {
      text: 'Detecté una desviación del ' + k.deviationPct + '%. Mayor contribución: Sector ' + top.sector + ', ' + top.id + (bad[1] ? ' y ' + bad[1].id : '') + '.',
      impact: incidents.filter(function (x) { return !x.closed && x.plantId === plantId; }).reduce(function (s, x) { return s + x.energyLoss_kWh; }, 0) + ' kWh estimados',
      rec: top.status === 'OFFLINE' ? 'Verificar comunicación de ' + top.id + '.' : 'Inspeccionar ' + top.id + ' y ventilación.',
      equipmentId: top.id,
      source: SOURCE,
      mode: 'RULE_ENGINE_DEMO'
    };
  }

  function advanceIncident(id, nextStatus, user) {
    const inc = incidents.find(function (i) { return i.id === id; });
    if (!inc) return null;
    inc.status = nextStatus;
    if (nextStatus === 'ACKNOWLEDGED') inc.acknowledgedAt = new Date().toISOString();
    if (nextStatus === 'RESOLVED') inc.resolvedAt = new Date().toISOString();
    if (nextStatus === 'CLOSED') { inc.closedAt = new Date().toISOString(); inc.closed = true; }
    if (user) inc.assignedTo = user;
    events.unshift({
      ts: new Date().toISOString(), plantId: inc.plantId, sector: inc.sector, equipment: inc.equipment,
      event: 'INCIDENT_' + nextStatus, severity: inc.severity, status: nextStatus, user: user || 'web',
      category: 'ALARMS', source: SOURCE
    });
    return inc;
  }

  function createWorkOrder(payload) {
    const wo = {
      id: 'WO-' + Date.now().toString().slice(-6),
      type: payload.type || 'CORRECTIVE',
      equipment: payload.equipment || '—',
      plantId: payload.plantId || 'PLT-001',
      sector: payload.sector || '—',
      status: 'OPEN',
      technician: payload.technician || null,
      priority: payload.priority || 'MEDIUM',
      createdAt: new Date().toISOString(),
      notes: payload.notes || '',
      parts: [], cost: 0, downtime_h: 0, source: SOURCE
    };
    workOrders.unshift(wo);
    events.unshift({
      ts: wo.createdAt, plantId: wo.plantId, sector: wo.sector, equipment: wo.equipment,
      event: 'WO_CREATED', severity: wo.priority, status: 'OPEN', user: 'web',
      category: 'MAINTENANCE', source: SOURCE
    });
    return wo;
  }

  function mttaMttr(plantId) {
    const closed = incidents.filter(function (i) {
      return i.plantId === plantId && i.acknowledgedAt;
    });
    // demo aggregates
    return { mtta_min: 6.5, mttr_h: 3.2, downtime_h: 5.1, energyLoss_kWh: 1032, source: SOURCE };
  }

  g.AEROVOLT_OM = {
    SOURCE: SOURCE,
    organizations: organizations,
    plants: plants,
    equipment: equipment,
    inverters: inverters,
    env: env,
    incidents: incidents,
    workOrders: workOrders,
    events: events,
    plantKpis: plantKpis,
    series: measurements,
    measurements: measurements,
    matrix: matrix,
    statusColor: statusColor,
    jarvisInsight: jarvisInsight,
    advanceIncident: advanceIncident,
    createWorkOrder: createWorkOrder,
    mttaMttr: mttaMttr,
    flowNodes: ['SOL', 'PV MODULES', 'STRINGS', 'INVERTERS', 'TRANSFORMERS', 'SWITCHGEAR', 'GRID']
  };
})(typeof window !== 'undefined' ? window : global);
