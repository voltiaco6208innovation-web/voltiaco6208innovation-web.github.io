/**
 * AEROVOLT JARVIS CORE v2 — ultraligero
 * - Una sola ruta de pérdida / soiling / finanzas
 * - ML STUB: regresión lineal sobre historial local (temp + ratio potencia)
 * - Alimenta predicciones_falla_jarvis + True Financial Yield (USD)
 * DEMO en memoria. No es un modelo entrenado en servidor ni LLM.
 */
(function (g) {
  'use strict';

  var SOURCE = 'DEMO';
  var MODE = 'ML_STUB_LINEAR_REGRESSION';
  var TARIFF = 0.12;
  var SOIL_RATIO = 0.80;
  var HIST_MAX = 21; // ~3 semanas de puntos diarios DEMO

  function iso() { return new Date().toISOString(); }
  function uid(p) { return p + '-' + Date.now().toString(36).toUpperCase() + (Math.random() * 90 + 10 | 0); }

  /** Regresión lineal simple y = a + b*x → retorna {a,b} o null */
  function linearFit(xs, ys) {
    var n = xs.length;
    if (n < 3) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) {
      sx += xs[i]; sy += ys[i];
      sxx += xs[i] * xs[i];
      sxy += xs[i] * ys[i];
    }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return null;
    var b = (n * sxy - sx * sy) / den;
    var a = (sy - b * sx) / n;
    return { a: a, b: b };
  }

  /** Cruce de umbral: días hasta y <= threshold si la pendiente es negativa */
  function daysUntilThreshold(fit, xLast, yLast, threshold) {
    if (!fit || fit.b >= -1e-6) return null;
    var xHit = (threshold - fit.a) / fit.b;
    var days = xHit - xLast;
    if (days < 0) return 0;
    return Math.min(90, Math.round(days));
  }

  function ensure(OM) {
    if (!OM.predicciones) OM.predicciones = [];
    if (!OM.misionesRoboticas) OM.misionesRoboticas = [];
    if (!OM._mlHistory) OM._mlHistory = {}; // inversor_id -> [{d, temp, ratio, power}]
    if (!OM._jarvisCfg) OM._jarvisCfg = { tariff: TARIFF, soilRatio: SOIL_RATIO };
  }

  function nominalKw(inv) {
    return inv.expected_kw > 0 ? inv.expected_kw / 0.95 : 100;
  }

  /** Único cálculo de ratio soiling / pérdida esperada */
  function powerContext(inv, irradiance) {
    var g = Number(irradiance) || 0;
    var power = Number(inv.power_kw) || 0;
    var pNom = nominalKw(inv);
    var expected = g > 0 ? (g / 1000) * pNom : (Number(inv.expected_kw) || pNom);
    var ratio = expected > 0 ? power / expected : 1;
    return {
      power: power,
      expected: +expected.toFixed(2),
      ratio: +ratio.toFixed(4),
      irradiance: g,
      pNom: pNom
    };
  }

  /** True Financial Yield / pérdida en USD (única función financiera) */
  function financialFromLossKwh(lossKwh, tariff) {
    var t = tariff > 0 ? tariff : TARIFF;
    var kwh = Math.max(0, Number(lossKwh) || 0);
    return {
      energyLoss_kWh: +kwh.toFixed(2),
      perdida_estimada_mwh: +(kwh / 1000).toFixed(4),
      tarifa_aplicada_usd_kwh: t,
      costo_financiero_acumulado_usd: +(kwh * t).toFixed(2),
      true_financial_yield_usd: +(-(kwh * t)).toFixed(2) // negativo = pérdida de yield
    };
  }

  function pushHistory(OM, inv, ctx) {
    var key = inv.id;
    if (!OM._mlHistory[key]) OM._mlHistory[key] = [];
    var h = OM._mlHistory[key];
    var dayIndex = h.length ? h[h.length - 1].d + 1 : 0;
    // DEMO: sintetiza tendencia si historial corto (degradación + ruido)
    var temp = inv.temp_c != null ? inv.temp_c : 42;
    h.push({
      d: dayIndex,
      temp: temp,
      ratio: ctx.ratio,
      power: ctx.power,
      expected: ctx.expected
    });
    if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX);
    // Bootstrap: si solo 1 punto, rellena tendencia DEMO de semanas previas
    if (h.length === 1) {
      var base = ctx.ratio;
      for (var i = HIST_MAX - 1; i >= 1; i--) {
        var r = Math.min(1.05, base + i * 0.008 + (Math.random() - 0.5) * 0.01);
        if (inv.status === 'FAULT' || inv.status === 'DEGRADED') r = Math.max(0.4, r - 0.02 * (HIST_MAX - i));
        h.unshift({
          d: dayIndex - i,
          temp: temp + (Math.random() - 0.5) * 4,
          ratio: +r.toFixed(4),
          power: +(ctx.expected * r).toFixed(2),
          expected: ctx.expected
        });
      }
      if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX);
      // reindex
      for (var j = 0; j < h.length; j++) h[j].d = j;
    }
    return h;
  }

  /**
   * ML STUB: aprende pendiente de ratio (y temperatura como covariable simple).
   * Predice días a limpieza (ratio→0.80) y días a falla operativa (ratio→0.55 o reglas de estado).
   */
  function mlPredict(OM, inv, ctx) {
    var h = pushHistory(OM, inv, ctx);
    var xs = h.map(function (p) { return p.d; });
    var ys = h.map(function (p) { return p.ratio; });
    var fit = linearFit(xs, ys);
    var xLast = xs[xs.length - 1];
    var yLast = ys[ys.length - 1];

    var daysClean = daysUntilThreshold(fit, xLast, yLast, SOIL_RATIO);
    var daysFail = daysUntilThreshold(fit, xLast, yLast, 0.55);

    // Ajuste por temperatura media reciente (degradación térmica DEMO)
    var tAvg = h.slice(-7).reduce(function (s, p) { return s + p.temp; }, 0) / Math.min(7, h.length);
    if (tAvg >= 55 && daysFail != null) daysFail = Math.max(0, daysFail - 3);
    if (tAvg >= 55 && daysClean != null) daysClean = Math.max(0, daysClean - 1);

    var prob = 0;
    var metric = 'trend_stable';
    var etaMins = null;

    if (inv.status === 'FAULT') {
      prob = 94; metric = 'status_FAULT'; etaMins = 20;
    } else if (inv.status === 'OFFLINE') {
      prob = 90; metric = 'comm_OFFLINE'; etaMins = 40;
    } else if (inv.status === 'DEGRADED') {
      prob = 76; metric = 'status_DEGRADED'; etaMins = 120;
    } else if (daysFail != null && daysFail <= 7) {
      prob = Math.min(95, 60 + (7 - daysFail) * 5);
      metric = 'ml_ratio_collapse';
      etaMins = Math.max(30, daysFail * 24 * 60);
    } else if (daysClean != null && daysClean <= 5) {
      prob = Math.min(85, 45 + (5 - daysClean) * 6);
      metric = 'ml_soiling_trend';
      etaMins = Math.max(60, daysClean * 24 * 60);
    } else if (ctx.ratio < SOIL_RATIO && ctx.irradiance > 50) {
      prob = 70; metric = 'soiling_now'; etaMins = 180;
    } else if (fit && fit.b < -0.01) {
      prob = 52; metric = 'ml_slow_degradation';
      etaMins = daysFail != null ? daysFail * 24 * 60 : 14 * 24 * 60;
    }

    if (prob < 50) {
      return {
        skip: true,
        days_to_clean: daysClean,
        days_to_fail: daysFail,
        slope: fit ? +fit.b.toFixed(5) : null,
        tAvg: +tAvg.toFixed(1)
      };
    }

    // Dedup: misma métrica en < 30 min
    var recent = OM.predicciones.find(function (p) {
      return p.inversor_id === inv.id && p.metrica_anomala === metric &&
        (Date.now() - new Date(p.fecha_prediccion).getTime()) < 30 * 60 * 1000;
    });
    if (recent) {
      recent.days_to_clean = daysClean;
      recent.days_to_fail = daysFail;
      recent.ml_slope = fit ? +fit.b.toFixed(5) : null;
      return { skip: true, existing: recent };
    }

    var pred = {
      id: uid('PRED'),
      inversor_id: inv.id,
      probabilidad_falla: prob,
      tiempo_estimado_paro_mins: etaMins,
      metrica_anomala: metric,
      planta_id: inv.plantId,
      sector: inv.sector,
      fecha_prediccion: iso(),
      days_to_clean: daysClean,
      days_to_fail: daysFail,
      ml_slope: fit ? +fit.b.toFixed(5) : null,
      ml_mode: MODE,
      source: SOURCE
    };
    OM.predicciones.unshift(pred);
    if (OM.predicciones.length > 100) OM.predicciones.length = 100;
    return { skip: false, pred: pred };
  }

  function openSoilIncident(OM, inv, ctx) {
    var open = OM.incidents.find(function (i) {
      return (i.equipment === inv.id || i.inversor_id === inv.id) &&
        (i.tipo_falla === 'PERDIDA_SUCIEDAD' || i.type === 'SOILING') &&
        !i.closed && i.status !== 'CLOSED';
    });
    if (open) return open;

    var lossKwh = Math.max(0, (ctx.expected - ctx.power) * 0.25);
    var fin = financialFromLossKwh(lossKwh, OM._jarvisCfg.tariff);
    var incId = uid('SOIL');
    var inc = {
      id: incId,
      time: iso(),
      plantId: inv.plantId,
      sector: inv.sector,
      equipment: inv.id,
      inversor_id: inv.id,
      type: 'SOILING',
      tipo_falla: 'PERDIDA_SUCIEDAD',
      severity: 'HIGH',
      status: 'NEW',
      description: 'Soiling ratio ' + ctx.ratio + ' (G=' + ctx.irradiance + ' W/m², P=' + ctx.power + ' vs exp ' + ctx.expected + ')',
      possibleCause: 'Polvo / suciedad / degradación de superficie',
      recommendedAction: 'Limpieza priorizada (oruga o crew)',
      assignedTo: null,
      acknowledgedAt: null,
      resolvedAt: null,
      closedAt: null,
      closed: false,
      source: SOURCE
    };
    Object.keys(fin).forEach(function (k) { inc[k] = fin[k]; });
    OM.incidents.unshift(inc);

    OM.misionesRoboticas.unshift({
      id: uid('MIS'),
      planta_id: inv.plantId,
      tipo_robot: 'ORUGA_CLEAN',
      coordenadas_destino_xyz: 'SECTOR_' + inv.sector + '_NEAR_' + inv.id,
      estado_mision: 'WAITING_HARDWARE',
      token_autenticacion: uid('TOK').replace(/-/g, '').slice(0, 32),
      inversor_id: inv.id,
      incident_id: incId,
      fecha_creacion: iso(),
      source: SOURCE
    });

    if (OM.events) {
      OM.events.unshift({
        ts: iso(), plantId: inv.plantId, sector: inv.sector, equipment: inv.id,
        event: 'SOILING_ALERT_AND_MISSION_QUEUED', severity: 'HIGH', status: 'NEW',
        user: 'jarvis-core', category: 'PERFORMANCE', source: SOURCE
      });
    }
    return inc;
  }

  /** Recalcula finanzas de todos los incidentes — una sola pasada */
  function refreshIncidentFinance(OM) {
    var tariff = OM._jarvisCfg.tariff;
    var totalLoss = 0;
    OM.incidents.forEach(function (inc) {
      var loss = Number(inc.energyLoss_kWh) || 0;
      if (!inc.closed && (inc.status === 'NEW' || inc.status === 'ACKNOWLEDGED' ||
          inc.status === 'INVESTIGATING' || inc.status === 'IN PROGRESS')) {
        loss += 0.05;
      }
      var fin = financialFromLossKwh(loss, tariff);
      Object.keys(fin).forEach(function (k) { inc[k] = fin[k]; });
      if (!inc.closed) totalLoss += fin.costo_financiero_acumulado_usd;
    });
    return totalLoss;
  }

  function runJarvisCycle(plantId) {
    var OM = g.AEROVOLT_OM;
    if (!OM) return { ok: false, error: 'AEROVOLT_OM missing' };
    ensure(OM);
    plantId = plantId || 'PLT-001';
    var irradiance = (OM.env && OM.env.irradiance) || 0;
    var list = (OM.equipment || OM.inverters || []).filter(function (i) {
      return i.plantId === plantId;
    });

    var soilN = 0, predN = 0, logs = [];

    for (var i = 0; i < list.length; i++) {
      var inv = list[i];
      var ctx = powerContext(inv, irradiance);

      // ML + predicción (incluye tendencia soiling a N días)
      var ml = mlPredict(OM, inv, ctx);
      if (ml && ml.pred) {
        predN++;
        logs.push('[ML] ' + inv.id + ' prob=' + ml.pred.probabilidad_falla +
          '% clean_in=' + ml.pred.days_to_clean + 'd fail_in=' + ml.pred.days_to_fail +
          'd slope=' + ml.pred.ml_slope);
      }

      // Soiling inmediato (ratio actual) — sin duplicar lógica de pérdida
      if (irradiance > 50 && ctx.ratio < SOIL_RATIO) {
        var inc = openSoilIncident(OM, inv, ctx);
        soilN++;
        logs.push('[SOIL] ' + inv.id + ' ratio=' + ctx.ratio + ' inc=' + inc.id +
          ' USD=' + inc.costo_financiero_acumulado_usd);
      }
    }

    var openCost = refreshIncidentFinance(OM);
    var trueYield = -openCost; // yield financiero perdido (USD)

    var summary = {
      ok: true,
      at: iso(),
      plantId: plantId,
      source: SOURCE,
      mode: MODE,
      soiling_alerts: soilN,
      predictions_new: predN,
      missions_waiting: OM.misionesRoboticas.filter(function (m) {
        return m.estado_mision === 'WAITING_HARDWARE';
      }).length,
      open_incident_cost_usd: +openCost.toFixed(2),
      true_financial_yield_usd: +trueYield.toFixed(2),
      logs: logs
    };
    OM._lastJarvisCycle = summary;
    return summary;
  }

  g.AEROVOLT_JARVIS = {
    SOURCE: SOURCE,
    MODE: MODE,
    TARIFF_USD_KWH: TARIFF,
    SOIL_THRESHOLD: SOIL_RATIO,
    runCycle: runJarvisCycle,
    linearFit: linearFit,
    powerContext: powerContext,
    financialFromLossKwh: financialFromLossKwh,
    ensureStores: function () { if (g.AEROVOLT_OM) ensure(g.AEROVOLT_OM); }
  };
})(typeof window !== 'undefined' ? window : global);
