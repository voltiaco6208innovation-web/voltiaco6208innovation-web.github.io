/**
 * AEROVOLT JARVIS CORE — ciclo de análisis O&M
 * - Eficiencia / pérdida por suciedad (irradiancia × potencia)
 * - Predicciones de pre-falla
 * - Cola de misiones robóticas (WAITING_HARDWARE)
 * - Costo financiero acumulado de incidentes
 *
 * DEMO en memoria (AEROVOLT_OM). Equivalente SQL en sql/schema_predictive_robotics.sql
 * No finge IA LLM ni hardware físico conectado.
 */
(function (g) {
  const SOURCE = 'DEMO';
  const TARIFF_USD_KWH = 0.12;
  const SOIL_THRESHOLD = 0.80; // potencia < 80% de esperada → suciedad

  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 100).toString().padStart(2, '0'); }

  function ensureStores(OM) {
    if (!OM.predicciones) OM.predicciones = [];
    if (!OM.misionesRoboticas) OM.misionesRoboticas = [];
    OM.incidents.forEach(function (inc) {
      if (inc.tarifa_aplicada_usd_kwh == null) inc.tarifa_aplicada_usd_kwh = TARIFF_USD_KWH;
      if (inc.costo_financiero_acumulado_usd == null) {
        var lossKwh = Number(inc.energyLoss_kWh) || 0;
        inc.costo_financiero_acumulado_usd = +(lossKwh * TARIFF_USD_KWH).toFixed(2);
      }
      if (inc.perdida_estimada_mwh == null) {
        inc.perdida_estimada_mwh = +((Number(inc.energyLoss_kWh) || 0) / 1000).toFixed(4);
      }
      if (!inc.tipo_falla && inc.type) {
        inc.tipo_falla = String(inc.type).replace(/\s+/g, '_').toUpperCase();
      }
    });
  }

  /** Nominal estimado del inversor para modelo de soiling (DEMO). */
  function nominalKw(inv) {
    if (inv.expected_kw && inv.expected_kw > 0) return inv.expected_kw / 0.95;
    return 100;
  }

  /**
   * Cruza irradiancia con kW reales.
   * potencia_esperada ≈ (G / 1000) * P_nominal
   * Si power_kw < 80% de esperada → PERDIDA_SUCIEDAD + misión ORUGA_CLEAN
   */
  function analizarEficienciaSuciedadJarvis(OM, inv, plantaId) {
    var env = OM.env || {};
    var irradiancia = Number(env.irradiance);
    if (!(irradiancia > 50)) return null; // noche / datos inválidos: no evaluar soiling

    var pNom = nominalKw(inv);
    var potenciaEsperada = (irradiancia / 1000.0) * pNom;
    var power = Number(inv.power_kw) || 0;
    var ratio = potenciaEsperada > 0 ? power / potenciaEsperada : 1;

    var result = {
      inversor_id: inv.id,
      planta_id: plantaId,
      irradiancia_w_m2: irradiancia,
      potencia_kw: power,
      potencia_esperada_kw: +potenciaEsperada.toFixed(2),
      ratio: +ratio.toFixed(3),
      soiling_alert: ratio < SOIL_THRESHOLD,
      source: SOURCE
    };

    if (!result.soiling_alert) return result;

    // ¿Ya hay incidente abierto de suciedad para este inversor?
    var open = OM.incidents.find(function (i) {
      return (i.equipment === inv.id || i.inversor_id === inv.id) &&
        (i.tipo_falla === 'PERDIDA_SUCIEDAD' || i.type === 'SOILING' || i.type === 'Excessive soiling') &&
        !i.closed && i.status !== 'CLOSED';
    });

    if (open) {
      result.incident_id = open.id;
      return result;
    }

    var lossKwh = Math.max(0, (potenciaEsperada - power) * 0.25); // DEMO: ~15 min equivalentes
    var incId = uid('SOIL');
    var inc = {
      id: incId,
      time: nowIso(),
      plantId: plantaId,
      sector: inv.sector,
      equipment: inv.id,
      inversor_id: inv.id,
      type: 'SOILING',
      tipo_falla: 'PERDIDA_SUCIEDAD',
      severity: 'HIGH',
      status: 'NEW',
      description: 'Pérdida por suciedad: potencia ' + power + ' kW vs esperada ' + potenciaEsperada.toFixed(1) + ' kW (G=' + irradiancia + ' W/m², ratio=' + ratio.toFixed(2) + ')',
      possibleCause: 'Soiling / polvo / excremento',
      recommendedAction: 'Despachar limpieza priorizada (oruga o crew)',
      assignedTo: null,
      acknowledgedAt: null,
      resolvedAt: null,
      closedAt: null,
      closed: false,
      energyLoss_kWh: +lossKwh.toFixed(2),
      perdida_estimada_mwh: +(lossKwh / 1000).toFixed(4),
      tarifa_aplicada_usd_kwh: TARIFF_USD_KWH,
      costo_financiero_acumulado_usd: +(lossKwh * TARIFF_USD_KWH).toFixed(2),
      source: SOURCE
    };
    OM.incidents.unshift(inc);

    var misId = uid('MIS');
    var token = uid('TOK').replace(/-/g, '').slice(0, 32);
    var mision = {
      id: misId,
      planta_id: plantaId,
      tipo_robot: 'ORUGA_CLEAN',
      coordenadas_destino_xyz: 'SECTOR_' + inv.sector + '_NEAR_' + inv.id,
      estado_mision: 'WAITING_HARDWARE',
      token_autenticacion: token,
      inversor_id: inv.id,
      incident_id: incId,
      fecha_creacion: nowIso(),
      source: SOURCE
    };
    OM.misionesRoboticas.unshift(mision);

    if (OM.events) {
      OM.events.unshift({
        ts: nowIso(), plantId: plantaId, sector: inv.sector, equipment: inv.id,
        event: 'SOILING_ALERT_AND_MISSION_QUEUED', severity: 'HIGH', status: 'NEW',
        user: 'jarvis-core', category: 'PERFORMANCE', source: SOURCE
      });
    }

    result.incident_id = incId;
    result.mission_id = misId;
    result.jarvis_log = '[JARVIS CORE] Alerta suciedad ' + inv.id + ' ratio=' + ratio.toFixed(2) + ' misión ' + misId + ' WAITING_HARDWARE';
    return result;
  }

  /** Pre-falla: temperatura alta, degradación, offline, desviación fuerte. */
  function predecirFalla(OM, inv, plantaId) {
    var prob = 0;
    var mins = null;
    var metrica = null;

    if (inv.status === 'FAULT') {
      prob = 92; mins = 15; metrica = 'status_FAULT';
    } else if (inv.status === 'OFFLINE') {
      prob = 88; mins = 30; metrica = 'comm_OFFLINE';
    } else if (inv.status === 'DEGRADED') {
      prob = 71; mins = 90; metrica = 'status_DEGRADED';
    } else if (inv.temp_c != null && inv.temp_c >= 58) {
      prob = 78; mins = 45; metrica = 'over_temperature';
    } else if (inv.temp_c != null && inv.temp_c >= 52) {
      prob = 55; mins = 120; metrica = 'elevated_temperature';
    } else if (inv.expected_kw > 0 && inv.power_kw < inv.expected_kw * 0.75 && inv.comm === 'ONLINE') {
      prob = 64; mins = 180; metrica = 'power_deviation';
    }

    if (prob < 50) return null;

    // Evitar duplicar predicción abierta reciente mismo equipo+métrica
    var recent = OM.predicciones.find(function (p) {
      return p.inversor_id === inv.id && p.metrica_anomala === metrica &&
        (Date.now() - new Date(p.fecha_prediccion).getTime()) < 30 * 60 * 1000;
    });
    if (recent) return recent;

    var pred = {
      id: uid('PRED'),
      inversor_id: inv.id,
      probabilidad_falla: prob,
      tiempo_estimado_paro_mins: mins,
      metrica_anomala: metrica,
      planta_id: plantaId,
      sector: inv.sector,
      fecha_prediccion: nowIso(),
      source: SOURCE
    };
    OM.predicciones.unshift(pred);
    return pred;
  }

  /** Recalcula costo financiero de todos los incidentes abiertos. */
  function actualizarCostosFinancieros(OM) {
    OM.incidents.forEach(function (inc) {
      var tariff = Number(inc.tarifa_aplicada_usd_kwh);
      if (!(tariff > 0)) tariff = TARIFF_USD_KWH;
      inc.tarifa_aplicada_usd_kwh = tariff;
      var loss = Number(inc.energyLoss_kWh) || 0;
      // DEMO: si sigue abierto, acumula un poco con el tiempo (simula pérdida continua)
      if (!inc.closed && (inc.status === 'NEW' || inc.status === 'ACKNOWLEDGED' || inc.status === 'INVESTIGATING' || inc.status === 'IN PROGRESS')) {
        loss = loss + 0.05; // +0.05 kWh por ciclo demo
        inc.energyLoss_kWh = +loss.toFixed(2);
      }
      inc.perdida_estimada_mwh = +(loss / 1000).toFixed(4);
      inc.costo_financiero_acumulado_usd = +(loss * tariff).toFixed(2);
    });
  }

  /** Ciclo principal JARVIS sobre una planta. */
  function runJarvisCycle(plantId) {
    var OM = g.AEROVOLT_OM;
    if (!OM) return { ok: false, error: 'AEROVOLT_OM missing' };
    ensureStores(OM);
    plantId = plantId || 'PLT-001';

    var list = (OM.equipment || OM.inverters || []).filter(function (i) {
      return i.plantId === plantId;
    });

    var soilResults = [];
    var preds = [];
    var logs = [];

    list.forEach(function (inv) {
      var soil = analizarEficienciaSuciedadJarvis(OM, inv, plantId);
      if (soil) {
        soilResults.push(soil);
        if (soil.jarvis_log) logs.push(soil.jarvis_log);
      }
      var pred = predecirFalla(OM, inv, plantId);
      if (pred) preds.push(pred);
    });

    actualizarCostosFinancieros(OM);

    var summary = {
      ok: true,
      at: nowIso(),
      plantId: plantId,
      source: SOURCE,
      soiling_alerts: soilResults.filter(function (s) { return s.soiling_alert; }).length,
      predictions_new: preds.length,
      missions_waiting: OM.misionesRoboticas.filter(function (m) { return m.estado_mision === 'WAITING_HARDWARE'; }).length,
      open_incident_cost_usd: OM.incidents.filter(function (i) { return !i.closed; }).reduce(function (s, i) {
        return s + (Number(i.costo_financiero_acumulado_usd) || 0);
      }, 0),
      logs: logs,
      mode: 'RULE_ENGINE_DEMO'
    };

    OM._lastJarvisCycle = summary;
    return summary;
  }

  g.AEROVOLT_JARVIS = {
    SOURCE: SOURCE,
    TARIFF_USD_KWH: TARIFF_USD_KWH,
    SOIL_THRESHOLD: SOIL_THRESHOLD,
    runCycle: runJarvisCycle,
    analizarEficienciaSuciedadJarvis: function (inv, plantaId) {
      var OM = g.AEROVOLT_OM;
      ensureStores(OM);
      return analizarEficienciaSuciedadJarvis(OM, inv, plantaId || 'PLT-001');
    },
    ensureStores: function () {
      if (g.AEROVOLT_OM) ensureStores(g.AEROVOLT_OM);
    }
  };
})(typeof window !== 'undefined' ? window : global);
