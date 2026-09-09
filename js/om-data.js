/** AEROVOLT O&M mock data — IEC 61724-oriented demo */
(function (g) {
  const plants = [
    { id: 'PLT-001', name: 'Norte Culiacán', capacityMWp: 5.2, sectors: ['A', 'B', 'C', 'D'] },
    { id: 'PLT-002', name: 'Industrial HMO', capacityMWp: 3.8, sectors: ['A', 'B', 'C'] }
  ];

  function inv(id, plantId, sector, power, expected, status, temp) {
    const pr = expected > 0 ? +((power / expected) * 100).toFixed(1) : 0;
    return {
      id: id, plantId: plantId, sector: sector,
      power_kw: power, expected_kw: expected, pr: pr,
      dc_v: 610 + Math.round(Math.random() * 40),
      dc_a: +(power * 1000 / (620) * (0.9 + Math.random() * 0.1)).toFixed(1),
      ac_v: 480 + Math.round(Math.random() * 8),
      ac_a: +(power * 1000 / 480 / 1.73).toFixed(1),
      ac_power_kw: +(power * 0.97).toFixed(1),
      freq: 60.0,
      pf: 0.99,
      temp_c: temp,
      efficiency: +(96 + Math.random() * 2).toFixed(1),
      status: status,
      comm: status === 'OFFLINE' ? 'OFFLINE' : status === 'FAULT' ? 'DEGRADED' : 'ONLINE',
      last_comm_s: status === 'OFFLINE' ? 180 : Math.round(Math.random() * 8),
      latency_ms: status === 'OFFLINE' ? null : 20 + Math.round(Math.random() * 40),
      protocol: 'Modbus TCP',
      gateway: 'GW-' + plantId.slice(-3),
      alarm: status === 'FAULT' ? 'Overtemperature / production deviation' : status === 'WARNING' ? 'Elevated temp' : null
    };
  }

  const inverters = [
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

  const env = {
    irradiance: 852,
    module_temp: 48.2,
    ambient_temp: 34.1,
    wind_speed: 3.2,
    wind_dir: 'SW',
    humidity: 42,
    rain_mm: 0,
    rain_acc_mm: 12.4,
    soiling_index: 0.18,
    cloud_cover: 15,
    solar_elevation: 62,
    forecast: 'Despejado · irradiancia alta'
  };

  function severityOf(status) {
    if (status === 'FAULT' || status === 'OFFLINE') return 'CRITICAL';
    if (status === 'DEGRADED') return 'HIGH';
    if (status === 'WARNING') return 'MEDIUM';
    return 'LOW';
  }

  const incidents = [
    { id: 'INC-1042', time: '2026-09-09T12:48:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'INV-07', type: 'Overtemperature', severity: 'CRITICAL', status: 'OPEN', ackBy: null, rootCause: null, action: null, closed: false, energyLoss_kWh: 184 },
    { id: 'INC-1041', time: '2026-09-09T12:41:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'INV-08', type: 'Production deviation', severity: 'HIGH', status: 'ACKNOWLEDGED', ackBy: 'op.ramos', rootCause: null, action: 'Investigating ventilation', closed: false, energyLoss_kWh: 96 },
    { id: 'INC-1040', time: '2026-09-09T11:20:00Z', plantId: 'PLT-001', sector: 'D', equipment: 'INV-13', type: 'Inverter offline', severity: 'CRITICAL', status: 'ASSIGNED', ackBy: 'op.ramos', rootCause: 'Communication loss', action: 'Tech dispatched', closed: false, energyLoss_kWh: 420 },
    { id: 'INC-1038', time: '2026-09-09T09:05:00Z', plantId: 'PLT-001', sector: 'C', equipment: 'INV-11', type: 'Abnormal temperature', severity: 'MEDIUM', status: 'INVESTIGATE', ackBy: 'tech.luna', rootCause: null, action: null, closed: false, energyLoss_kWh: 22 },
    { id: 'INC-1035', time: '2026-09-08T16:12:00Z', plantId: 'PLT-001', sector: 'A', equipment: 'SENSOR-IRR-01', type: 'Sensor warning', severity: 'MEDIUM', status: 'CLOSED', ackBy: 'tech.luna', rootCause: 'Dirty irradiance sensor', action: 'Cleaned', closed: true, energyLoss_kWh: 0 },
    { id: 'INC-1031', time: '2026-09-08T08:00:00Z', plantId: 'PLT-001', sector: 'B', equipment: 'SECTOR-B', type: 'Excessive soiling', severity: 'HIGH', status: 'CLOSED', ackBy: 'om.manager', rootCause: 'Dust event', action: 'Priority cleaning', closed: true, energyLoss_kWh: 310 }
  ];

  function plantKpis(plantId) {
    const list = inverters.filter(function (i) { return i.plantId === plantId; });
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
      pr: pr,
      availability: avail,
      specificYield: yieldSpec,
      co2_t: co2,
      power_kw: +power.toFixed(1),
      expected_kw: +expected.toFixed(1),
      deviationPct: expected > 0 ? +(((expected - power) / expected) * 100).toFixed(1) : 0
    };
  }

  function series(hours) {
    const labels = [];
    const dc = []; const ac = []; const exp = []; const irr = []; const act = []; const expP = [];
    const base = plantKpis('PLT-001').power_kw;
    for (let i = 0; i < hours; i++) {
      const h = (6 + i * (12 / Math.max(hours - 1, 1)));
      labels.push(String(Math.floor(h)).padStart(2, '0') + ':00');
      const factor = Math.max(0, Math.sin((i / hours) * Math.PI));
      const noise = 0.92 + Math.random() * 0.08;
      const e = base * factor;
      const a = e * noise * (i > hours * 0.55 && i < hours * 0.7 ? 0.88 : 1);
      dc.push(+e.toFixed(1));
      ac.push(+(a * 0.97).toFixed(1));
      exp.push(+e.toFixed(1));
      irr.push(Math.round(200 + 750 * factor));
      act.push(+(a / 1000).toFixed(3));
      expP.push(+(e / 1000).toFixed(3));
    }
    return { labels: labels, dc: dc, ac: ac, expected: exp, irr: irr, actualMWh: act, expectedMWh: expP };
  }

  function matrix(plantId) {
    const list = inverters.filter(function (i) { return i.plantId === plantId; });
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
    if (st === 'FAULT') return { key: 'fault', label: 'FAULT', emoji: '🔴' };
    return { key: 'off', label: 'OFFLINE', emoji: '⚫' };
  }

  function jarvisInsight(plantId) {
    const k = plantKpis(plantId);
    const bad = inverters.filter(function (i) {
      return i.plantId === plantId && (i.status === 'FAULT' || i.status === 'DEGRADED' || i.status === 'OFFLINE');
    });
    if (!bad.length) {
      return {
        text: 'Operación estable. PR ' + k.pr + '%. Sin desviaciones críticas en los últimos 15 min.',
        impact: '0 kWh',
        rec: 'Continuar monitoreo rutinario.'
      };
    }
    const top = bad.sort(function (a, b) { return a.power_kw - b.power_kw; })[0];
    return {
      text: 'Detecté una desviación del ' + k.deviationPct + '%. La mayor contribución proviene del Sector ' + top.sector + ', particularmente ' + top.id + (bad[1] ? ' y ' + bad[1].id : '') + '.',
      impact: (incidents.filter(function (x) { return !x.closed && x.plantId === plantId; }).reduce(function (s, x) { return s + x.energyLoss_kWh; }, 0)) + ' kWh estimados',
      rec: top.status === 'OFFLINE'
        ? 'Verificar comunicación y gateway de ' + top.id + '.'
        : 'Inspeccionar ' + top.id + ' y verificar ventilación / temperatura.'
    };
  }

  g.AEROVOLT_OM = {
    plants: plants,
    inverters: inverters,
    env: env,
    incidents: incidents,
    plantKpis: plantKpis,
    series: series,
    matrix: matrix,
    statusColor: statusColor,
    jarvisInsight: jarvisInsight,
    severityOf: severityOf,
    flowNodes: ['SOL', 'PANELES', 'STRINGS', 'INVERSORES', 'TRANSFORMADOR', 'SWITCHGEAR', 'GRID']
  };
})(typeof window !== 'undefined' ? window : global);
