/**
 * AEROVOLT JARVIS CORE v2.1
 * - Regresión lineal + validación cruzada k-fold (anti-sobreajuste)
 * - Clima en vivo: Open-Meteo (Sonora/Hermosillo) → irradiancia, temp, viento
 * - Fallback DEMO si la API falla
 * Una sola ruta de pérdida / finanzas / predicciones
 */
(function (g) {
  'use strict';

  var SOURCE = 'DEMO';
  var MODE = 'ML_STUB_LINEAR_CV';
  var TARIFF = 0.12;
  var SOIL_RATIO = 0.80;
  var HIST_MAX = 21;
  var K_FOLDS = 5;

  // Desierto de Sonora · Hermosillo (aprox.)
  var WEATHER_LAT = 29.0729;
  var WEATHER_LON = -110.9559;
  var WEATHER_URL =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    WEATHER_LAT +
    '&longitude=' +
    WEATHER_LON +
    '&current=temperature_2m,wind_speed_10m,shortwave_radiation,cloud_cover,relative_humidity_2m' +
    '&timezone=America%2FHermosillo';

  function iso() { return new Date().toISOString(); }
  function uid(p) {
    return p + '-' + Date.now().toString(36).toUpperCase() + ((Math.random() * 90) | 0 + 10);
  }

  function linearFit(xs, ys) {
    var n = xs.length;
    if (n < 3) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) {
      sx += xs[i];
      sy += ys[i];
      sxx += xs[i] * xs[i];
      sxy += xs[i] * ys[i];
    }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return null;
    var b = (n * sxy - sx * sy) / den;
    var a = (sy - b * sx) / n;
    return { a: a, b: b };
  }

  function predictY(fit, x) {
    return fit.a + fit.b * x;
  }

  /**
   * Validación cruzada k-fold sobre (xs, ys).
   * Entrena en k-1 folds, mide MAE/RMSE en el fold de test.
   * Reduce confianza si el error de validación es alto (sobreajuste / ruido).
   */
  function crossValidate(xs, ys, k) {
    var n = xs.length;
    k = Math.max(2, Math.min(k || K_FOLDS, Math.floor(n / 2) || 2));
    if (n < 6) {
      return { folds: 0, mae: null, rmse: null, reliable: false, reason: 'insufficient_samples' };
    }

    var indices = [];
    for (var i = 0; i < n; i++) indices.push(i);
    // shuffle determinista-ligero por suma de ys (reproducible en DEMO)
    var seed = ys.reduce(function (s, v) { return s + v * 1000; }, 0) | 0;
    for (var s = n - 1; s > 0; s--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var j = seed % (s + 1);
      var tmp = indices[s];
      indices[s] = indices[j];
      indices[j] = tmp;
    }

    var foldSize = Math.floor(n / k);
    var maeSum = 0, rmseSum = 0, used = 0;

    for (var f = 0; f < k; f++) {
      var start = f * foldSize;
      var end = f === k - 1 ? n : start + foldSize;
      if (end - start < 1) continue;

      var xTrain = [], yTrain = [], xTest = [], yTest = [];
      for (var t = 0; t < n; t++) {
        var idx = indices[t];
        if (t >= start && t < end) {
          xTest.push(xs[idx]);
          yTest.push(ys[idx]);
        } else {
          xTrain.push(xs[idx]);
          yTrain.push(ys[idx]);
        }
      }
      if (xTrain.length < 3 || xTest.length < 1) continue;

      var fit = linearFit(xTrain, yTrain);
      if (!fit) continue;

      var absErr = 0, sqErr = 0;
      for (var u = 0; u < xTest.length; u++) {
        var err = predictY(fit, xTest[u]) - yTest[u];
        absErr += Math.abs(err);
        sqErr += err * err;
      }
      maeSum += absErr / xTest.length;
      rmseSum += Math.sqrt(sqErr / xTest.length);
      used++;
    }

    if (!used) {
      return { folds: 0, mae: null, rmse: null, reliable: false, reason: 'cv_failed' };
    }

    var mae = maeSum / used;
    var rmse = rmseSum / used;
    // Umbral DEMO: ratio está en ~0.4–1.1; MAE > 0.12 se considera poco fiable
    var reliable = mae <= 0.12 && rmse <= 0.18;

    return {
      folds: used,
      mae: +mae.toFixed(4),
      rmse: +rmse.toFixed(4),
      reliable: reliable,
      reason: reliable ? 'cv_ok' : 'high_cv_error'
    };
  }

  function daysUntilThreshold(fit, xLast, threshold) {
    if (!fit || fit.b >= -1e-6) return null;
    var xHit = (threshold - fit.a) / fit.b;
    var days = xHit - xLast;
    if (days < 0) return 0;
    return Math.min(90, Math.round(days));
  }

  function ensure(OM) {
    if (!OM.predicciones) OM.predicciones = [];
    if (!OM.misionesRoboticas) OM.misionesRoboticas = [];
    if (!OM._mlHistory) OM._mlHistory = {};
    if (!OM._jarvisCfg) {
      OM._jarvisCfg = {
        tariff: TARIFF,
        soilRatio: SOIL_RATIO,
        weatherProvider: 'open-meteo',
        weatherLat: WEATHER_LAT,
        weatherLon: WEATHER_LON
      };
    }
    if (!OM._weatherLive) {
      OM._weatherLive = {
        source: 'DEMO',
        status: 'not_fetched',
        irradiance: null,
        ambient_temp: null,
        wind_speed: null,
        cloud_cover: null,
        humidity: null,
        at: null,
        error: null
      };
    }
  }

  function nominalKw(inv) {
    return inv.expected_kw > 0 ? inv.expected_kw / 0.95 : 100;
  }

  function powerContext(inv, irradiance) {
    var g = Number(irradiance) || 0;
    var power = Number(inv.power_kw) || 0;
    var pNom = nominalKw(inv);
    var expected = g > 0 ? (g / 1000) * pNom : Number(inv.expected_kw) || pNom;
    var ratio = expected > 0 ? power / expected : 1;
    return {
      power: power,
      expected: +expected.toFixed(2),
      ratio: +ratio.toFixed(4),
      irradiance: g,
      pNom: pNom
    };
  }

  function financialFromLossKwh(lossKwh, tariff) {
    var t = tariff > 0 ? tariff : TARIFF;
    var kwh = Math.max(0, Number(lossKwh) || 0);
    return {
      energyLoss_kWh: +kwh.toFixed(2),
      perdida_estimada_mwh: +(kwh / 1000).toFixed(4),
      tarifa_aplicada_usd_kwh: t,
      costo_financiero_acumulado_usd: +(kwh * t).toFixed(2),
      true_financial_yield_usd: +(-(kwh * t)).toFixed(2)
    };
  }

  /**
   * Clima en vivo vía Open-Meteo (sin API key).
   * shortwave_radiation ≈ irradiancia global horizontal W/m².
   * Actualiza OM.env para que todo el O&M use la misma lectura.
   */
  function fetchLiveWeather(OM) {
    ensure(OM);
    if (typeof fetch !== 'function') {
      OM._weatherLive.status = 'no_fetch_api';
      OM._weatherLive.source = 'DEMO';
      return Promise.resolve(OM._weatherLive);
    }

    OM._weatherLive.status = 'loading';

    return fetch(WEATHER_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var cur = data.current || {};
        var irr = Number(cur.shortwave_radiation);
        var temp = Number(cur.temperature_2m);
        var wind = Number(cur.wind_speed_10m);
        var cloud = Number(cur.cloud_cover);
        var hum = Number(cur.relative_humidity_2m);

        OM._weatherLive = {
          source: 'OPEN_METEO_LIVE',
          status: 'ok',
          irradiance: isFinite(irr) ? irr : null,
          ambient_temp: isFinite(temp) ? temp : null,
          wind_speed: isFinite(wind) ? wind : null,
          cloud_cover: isFinite(cloud) ? cloud : null,
          humidity: isFinite(hum) ? hum : null,
          at: iso(),
          error: null,
          provider: 'open-meteo',
          location: 'Sonora/Hermosillo',
          lat: WEATHER_LAT,
          lon: WEATHER_LON
        };

        // Inyectar en env compartido (misma fuente que Performance/Environment)
        if (!OM.env) OM.env = {};
        if (OM._weatherLive.irradiance != null) OM.env.irradiance = OM._weatherLive.irradiance;
        if (OM._weatherLive.ambient_temp != null) OM.env.ambient_temp = OM._weatherLive.ambient_temp;
        if (OM._weatherLive.wind_speed != null) OM.env.wind_speed = OM._weatherLive.wind_speed;
        if (OM._weatherLive.cloud_cover != null) OM.env.cloud_cover = OM._weatherLive.cloud_cover;
        if (OM._weatherLive.humidity != null) OM.env.humidity = OM._weatherLive.humidity;
        OM.env.weather_source = 'OPEN_METEO_LIVE';
        OM.env.weather_at = OM._weatherLive.at;

        return OM._weatherLive;
      })
      .catch(function (err) {
        OM._weatherLive.status = 'error';
        OM._weatherLive.source = 'DEMO';
        OM._weatherLive.error = String(err && err.message ? err.message : err);
        OM._weatherLive.at = iso();
        if (OM.env) OM.env.weather_source = 'DEMO_FALLBACK';
        return OM._weatherLive;
      });
  }

  function pushHistory(OM, inv, ctx) {
    var key = inv.id;
    if (!OM._mlHistory[key]) OM._mlHistory[key] = [];
    var h = OM._mlHistory[key];
    var dayIndex = h.length ? h[h.length - 1].d + 1 : 0;
    var temp = inv.temp_c != null ? inv.temp_c : (OM.env && OM.env.ambient_temp) || 42;

    h.push({
      d: dayIndex,
      temp: temp,
      ratio: ctx.ratio,
      power: ctx.power,
      expected: ctx.expected
    });
    if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX);

    if (h.length === 1) {
      var base = ctx.ratio;
      for (var i = HIST_MAX - 1; i >= 1; i--) {
        var r = Math.min(1.05, base + i * 0.008 + (Math.random() - 0.5) * 0.01);
        if (inv.status === 'FAULT' || inv.status === 'DEGRADED') {
          r = Math.max(0.4, r - 0.02 * (HIST_MAX - i));
        }
        h.unshift({
          d: dayIndex - i,
          temp: temp + (Math.random() - 0.5) * 4,
          ratio: +r.toFixed(4),
          power: +(ctx.expected * r).toFixed(2),
          expected: ctx.expected
        });
      }
      if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX);
      for (var j = 0; j < h.length; j++) h[j].d = j;
    }
    return h;
  }

  function mlPredict(OM, inv, ctx) {
    var h = pushHistory(OM, inv, ctx);
    var xs = h.map(function (p) { return p.d; });
    var ys = h.map(function (p) { return p.ratio; });

    var cv = crossValidate(xs, ys, K_FOLDS);
    var fit = linearFit(xs, ys);
    var xLast = xs[xs.length - 1];

    var daysClean = daysUntilThreshold(fit, xLast, SOIL_RATIO);
    var daysFail = daysUntilThreshold(fit, xLast, 0.55);

    var tAvg =
      h.slice(-7).reduce(function (s, p) { return s + p.temp; }, 0) / Math.min(7, h.length);
    if (tAvg >= 55 && daysFail != null) daysFail = Math.max(0, daysFail - 3);
    if (tAvg >= 55 && daysClean != null) daysClean = Math.max(0, daysClean - 1);

    var prob = 0;
    var metric = 'trend_stable';
    var etaMins = null;

    if (inv.status === 'FAULT') {
      prob = 94;
      metric = 'status_FAULT';
      etaMins = 20;
    } else if (inv.status === 'OFFLINE') {
      prob = 90;
      metric = 'comm_OFFLINE';
      etaMins = 40;
    } else if (inv.status === 'DEGRADED') {
      prob = 76;
      metric = 'status_DEGRADED';
      etaMins = 120;
    } else if (daysFail != null && daysFail <= 7) {
      prob = Math.min(95, 60 + (7 - daysFail) * 5);
      metric = 'ml_ratio_collapse';
      etaMins = Math.max(30, daysFail * 24 * 60);
    } else if (daysClean != null && daysClean <= 5) {
      prob = Math.min(85, 45 + (5 - daysClean) * 6);
      metric = 'ml_soiling_trend';
      etaMins = Math.max(60, daysClean * 24 * 60);
    } else if (ctx.ratio < SOIL_RATIO && ctx.irradiance > 50) {
      prob = 70;
      metric = 'soiling_now';
      etaMins = 180;
    } else if (fit && fit.b < -0.01) {
      prob = 52;
      metric = 'ml_slow_degradation';
      etaMins = daysFail != null ? daysFail * 24 * 60 : 14 * 24 * 60;
    }

    // Penalizar probabilidad si CV indica sobreajuste / error alto
    if (cv.folds > 0 && !cv.reliable && prob > 0) {
      prob = Math.max(40, Math.round(prob * 0.75));
      metric = metric + '_cv_penalized';
    }

    if (prob < 50) {
      return {
        skip: true,
        days_to_clean: daysClean,
        days_to_fail: daysFail,
        slope: fit ? +fit.b.toFixed(5) : null,
        cv: cv,
        tAvg: +tAvg.toFixed(1)
      };
    }

    var recent = OM.predicciones.find(function (p) {
      return (
        p.inversor_id === inv.id &&
        p.metrica_anomala === metric &&
        Date.now() - new Date(p.fecha_prediccion).getTime() < 30 * 60 * 1000
      );
    });
    if (recent) {
      recent.days_to_clean = daysClean;
      recent.days_to_fail = daysFail;
      recent.ml_slope = fit ? +fit.b.toFixed(5) : null;
      recent.cv_mae = cv.mae;
      recent.cv_rmse = cv.rmse;
      recent.cv_reliable = cv.reliable;
      return { skip: true, existing: recent, cv: cv };
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
      cv_folds: cv.folds,
      cv_mae: cv.mae,
      cv_rmse: cv.rmse,
      cv_reliable: cv.reliable,
      ml_mode: MODE,
      source: SOURCE
    };
    OM.predicciones.unshift(pred);
    if (OM.predicciones.length > 100) OM.predicciones.length = 100;
    return { skip: false, pred: pred, cv: cv };
  }

  function openSoilIncident(OM, inv, ctx) {
    var open = OM.incidents.find(function (i) {
      return (
        (i.equipment === inv.id || i.inversor_id === inv.id) &&
        (i.tipo_falla === 'PERDIDA_SUCIEDAD' || i.type === 'SOILING') &&
        !i.closed &&
        i.status !== 'CLOSED'
      );
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
      description:
        'Soiling ratio ' +
        ctx.ratio +
        ' (G=' +
        ctx.irradiance +
        ' W/m2, P=' +
        ctx.power +
        ' vs exp ' +
        ctx.expected +
        ', weather=' +
        ((OM.env && OM.env.weather_source) || 'DEMO') +
        ')',
      possibleCause: 'Polvo / suciedad',
      recommendedAction: 'Limpieza priorizada',
      assignedTo: null,
      acknowledgedAt: null,
      resolvedAt: null,
      closedAt: null,
      closed: false,
      source: SOURCE
    };
    Object.keys(fin).forEach(function (k) {
      inc[k] = fin[k];
    });
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
        ts: iso(),
        plantId: inv.plantId,
        sector: inv.sector,
        equipment: inv.id,
        event: 'SOILING_ALERT_AND_MISSION_QUEUED',
        severity: 'HIGH',
        status: 'NEW',
        user: 'jarvis-core',
        category: 'PERFORMANCE',
        source: SOURCE
      });
    }
    return inc;
  }

  function refreshIncidentFinance(OM) {
    var tariff = OM._jarvisCfg.tariff;
    var totalLoss = 0;
    OM.incidents.forEach(function (inc) {
      var loss = Number(inc.energyLoss_kWh) || 0;
      if (
        !inc.closed &&
        (inc.status === 'NEW' ||
          inc.status === 'ACKNOWLEDGED' ||
          inc.status === 'INVESTIGATING' ||
          inc.status === 'IN PROGRESS')
      ) {
        loss += 0.05;
      }
      var fin = financialFromLossKwh(loss, tariff);
      Object.keys(fin).forEach(function (k) {
        inc[k] = fin[k];
      });
      if (!inc.closed) totalLoss += fin.costo_financiero_acumulado_usd;
    });
    return totalLoss;
  }

  function runCycleSync(plantId) {
    var OM = g.AEROVOLT_OM;
    if (!OM) return { ok: false, error: 'AEROVOLT_OM missing' };
    ensure(OM);
    plantId = plantId || 'PLT-001';

    var irradiance = (OM.env && OM.env.irradiance) || 0;
    var list = (OM.equipment || OM.inverters || []).filter(function (i) {
      return i.plantId === plantId;
    });

    var soilN = 0,
      predN = 0,
      logs = [],
      cvSamples = [];

    for (var i = 0; i < list.length; i++) {
      var inv = list[i];
      var ctx = powerContext(inv, irradiance);
      var ml = mlPredict(OM, inv, ctx);

      if (ml && ml.cv && ml.cv.folds) cvSamples.push(ml.cv);
      if (ml && ml.pred) {
        predN++;
        logs.push(
          '[ML+CV] ' +
            inv.id +
            ' prob=' +
            ml.pred.probabilidad_falla +
            '% mae=' +
            ml.pred.cv_mae +
            ' reliable=' +
            ml.pred.cv_reliable +
            ' clean_d=' +
            ml.pred.days_to_clean +
            ' fail_d=' +
            ml.pred.days_to_fail
        );
      }

      if (irradiance > 50 && ctx.ratio < SOIL_RATIO) {
        var inc = openSoilIncident(OM, inv, ctx);
        soilN++;
        logs.push(
          '[SOIL] ' +
            inv.id +
            ' ratio=' +
            ctx.ratio +
            ' G=' +
            irradiance +
            ' USD=' +
            inc.costo_financiero_acumulado_usd
        );
      }
    }

    var openCost = refreshIncidentFinance(OM);
    var avgMae =
      cvSamples.length > 0
        ? cvSamples.reduce(function (s, c) { return s + (c.mae || 0); }, 0) / cvSamples.length
        : null;

    var summary = {
      ok: true,
      at: iso(),
      plantId: plantId,
      source: SOURCE,
      mode: MODE,
      weather_source: (OM.env && OM.env.weather_source) || (OM._weatherLive && OM._weatherLive.source) || 'DEMO',
      weather_status: OM._weatherLive && OM._weatherLive.status,
      irradiance: irradiance,
      ambient_temp: OM.env && OM.env.ambient_temp,
      wind_speed: OM.env && OM.env.wind_speed,
      soiling_alerts: soilN,
      predictions_new: predN,
      cv_avg_mae: avgMae != null ? +avgMae.toFixed(4) : null,
      missions_waiting: OM.misionesRoboticas.filter(function (m) {
        return m.estado_mision === 'WAITING_HARDWARE';
      }).length,
      open_incident_cost_usd: +openCost.toFixed(2),
      true_financial_yield_usd: +(-openCost).toFixed(2),
      logs: logs
    };
    OM._lastJarvisCycle = summary;
    return summary;
  }

  /** Ciclo principal: primero clima en vivo, luego ML+CV */
  function runJarvisCycle(plantId) {
    var OM = g.AEROVOLT_OM;
    if (!OM) return Promise.resolve({ ok: false, error: 'AEROVOLT_OM missing' });
    ensure(OM);

    return fetchLiveWeather(OM).then(function (w) {
      var summary = runCycleSync(plantId);
      summary.weather = w;
      OM._lastJarvisCycle = summary;
      return summary;
    });
  }

  g.AEROVOLT_JARVIS = {
    SOURCE: SOURCE,
    MODE: MODE,
    TARIFF_USD_KWH: TARIFF,
    SOIL_THRESHOLD: SOIL_RATIO,
    WEATHER_URL: WEATHER_URL,
    runCycle: runJarvisCycle,
    runCycleSync: runCycleSync,
    fetchLiveWeather: function () {
      return fetchLiveWeather(g.AEROVOLT_OM);
    },
    crossValidate: crossValidate,
    linearFit: linearFit,
    powerContext: powerContext,
    financialFromLossKwh: financialFromLossKwh,
    ensureStores: function () {
      if (g.AEROVOLT_OM) ensure(g.AEROVOLT_OM);
    }
  };
})(typeof window !== 'undefined' ? window : global);
