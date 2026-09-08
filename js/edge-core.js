/**
 * AEROVOLT Edge Core — capa operativa en plataforma web
 * Modos: DEMO (simulación segura) | FIELD (drivers industriales listos; requieren gateway real)
 * Sin Cyberdeck: audio físico e impresora descartados.
 */
(function (global) {
  const STORAGE = {
    mode: 'aerovolt_mode',
    events: 'aerovolt_events',
    inspections: 'aerovolt_inspections',
    shutdowns: 'aerovolt_shutdowns',
    vision: 'aerovolt_vision_cfg',
    thermal: 'aerovolt_thermal_cfg'
  };

  const INTERVAL_17H_MS = 17 * 60 * 60 * 1000;

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  const listeners = {};

  const Edge = {
    version: '1.0.0',
    mode: load(STORAGE.mode, 'DEMO'),

    setMode: function (mode) {
      if (mode !== 'DEMO' && mode !== 'FIELD') return;
      this.mode = mode;
      save(STORAGE.mode, mode);
      this.emit('MODE', { mode: mode, at: nowIso() });
    },

    on: function (type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },

    emit: function (type, payload) {
      const ev = {
        id: uid('evt'),
        type: type,
        at: nowIso(),
        mode: this.mode,
        payload: payload || {}
      };
      const all = load(STORAGE.events, []);
      all.unshift(ev);
      save(STORAGE.events, all.slice(0, 200));
      (listeners[type] || []).forEach(function (fn) {
        try { fn(ev); } catch (e) {}
      });
      (listeners['*'] || []).forEach(function (fn) {
        try { fn(ev); } catch (e) {}
      });
      return ev;
    },

    listEvents: function (limit) {
      return load(STORAGE.events, []).slice(0, limit || 50);
    },

    /**
     * Adaptadores industriales (stubs).
     * En DEMO solo registran. En FIELD intentan webhook configurado.
     */
    industrial: {
      modbus: {
        enabled: false,
        host: '',
        unitId: 1,
        coilShutdown: 0
      },
      mqtt: {
        enabled: false,
        topicShutdown: 'aerovolt/plant/shutdown',
        topicTelemetry: 'aerovolt/plant/telemetry'
      },
      webhookUrl: load('aerovolt_webhook', '')
    },

    configureIndustrial: function (cfg) {
      Object.assign(this.industrial.modbus, cfg.modbus || {});
      Object.assign(this.industrial.mqtt, cfg.mqtt || {});
      if (cfg.webhookUrl !== undefined) {
        this.industrial.webhookUrl = cfg.webhookUrl;
        localStorage.setItem('aerovolt_webhook', cfg.webhookUrl || '');
      }
      this.emit('CONFIG', { industrial: this.industrial });
    },

    /**
     * Protocolo de apagado de emergencia.
     * DEMO: simula éxito y deja auditoría.
     * FIELD: POST al webhook/gateway; sin gateway real no ejecuta corte físico.
     */
    emergencyShutdown: async function (opts) {
      opts = opts || {};
      const plantId = opts.plantId || 'PLT-001';
      const equipmentId = opts.equipmentId || 'ALL';
      const reason = opts.reason || 'Emergencia operador';
      const operator = opts.operator || 'HMO-OPERATOR';
      const confirm = opts.confirm === true;

      if (!confirm) {
        return { ok: false, error: 'Se requiere confirmación explícita (confirm: true)' };
      }

      const record = {
        id: uid('sd'),
        at: nowIso(),
        mode: this.mode,
        plantId: plantId,
        equipmentId: equipmentId,
        reason: reason,
        operator: operator,
        channel: this.mode === 'FIELD' ? 'GATEWAY' : 'SIMULATED',
        status: 'PENDING'
      };

      if (this.mode === 'DEMO') {
        record.status = 'SIMULATED_OK';
        record.detail = 'Apagado simulado. Sin salida física. Listo para conectar Modbus/MQTT/relevador.';
        const list = load(STORAGE.shutdowns, []);
        list.unshift(record);
        save(STORAGE.shutdowns, list.slice(0, 100));
        this.emit('SHUTDOWN', record);
        if (global.AEROVOLT && AEROVOLT.inverters) {
          AEROVOLT.inverters.forEach(function (inv) {
            if (equipmentId === 'ALL' || inv.id === equipmentId || inv.plantId === plantId) {
              if (inv.status !== 'CRITICO') {
                inv._prevStatus = inv.status;
                inv.status = 'CRITICO';
                inv.power_kw = 0;
                inv.alarm = 'EMERGENCY SHUTDOWN (DEMO)';
              }
            }
          });
        }
        return { ok: true, record: record };
      }

      // FIELD: intentar webhook de gateway industrial
      const url = this.industrial.webhookUrl;
      if (!url) {
        record.status = 'BLOCKED';
        record.detail = 'FIELD sin webhook/gateway configurado. No se envió orden física.';
        const list2 = load(STORAGE.shutdowns, []);
        list2.unshift(record);
        save(STORAGE.shutdowns, list2.slice(0, 100));
        this.emit('SHUTDOWN', record);
        return { ok: false, error: 'Configure webhook industrial (Edge.configureIndustrial)', record: record };
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'emergency_shutdown',
            modbus: this.industrial.modbus,
            mqtt: this.industrial.mqtt,
            plantId: plantId,
            equipmentId: equipmentId,
            reason: reason,
            operator: operator,
            at: record.at
          })
        });
        record.status = res.ok ? 'SENT' : 'GATEWAY_ERROR';
        record.http = res.status;
        record.detail = res.ok ? 'Orden enviada al gateway' : 'Gateway respondió error';
      } catch (e) {
        record.status = 'NETWORK_ERROR';
        record.detail = String(e.message || e);
      }

      const list3 = load(STORAGE.shutdowns, []);
      list3.unshift(record);
      save(STORAGE.shutdowns, list3.slice(0, 100));
      this.emit('SHUTDOWN', record);
      return { ok: record.status === 'SENT', record: record };
    },

    listShutdowns: function () {
      return load(STORAGE.shutdowns, []);
    },

    /**
     * Visión artificial — inspección de suciedad / excremento.
     * DEMO: genera registro sintético. FIELD: espera captura real vía input/API.
     */
    vision: {
      getConfig: function () {
        return load(STORAGE.vision, {
          intervalMs: INTERVAL_17H_MS,
          enabled: true,
          lastRun: null,
          nextRun: null,
          model: 'soiling-bird-v1-stub',
          threshold: 0.55
        });
      },
      setConfig: function (cfg) {
        const cur = Edge.vision.getConfig();
        const next = Object.assign({}, cur, cfg || {});
        save(STORAGE.vision, next);
        return next;
      },
      runInspection: function (opts) {
        opts = opts || {};
        const cfg = Edge.vision.getConfig();
        const score = opts.score != null ? opts.score : +(Math.random() * 0.45 + (Math.random() > 0.7 ? 0.4 : 0)).toFixed(3);
        const hit = score >= cfg.threshold;
        const labels = [];
        if (hit && score > 0.7) labels.push('excremento_ave');
        if (hit && score > 0.55) labels.push('suciedad');
        if (!labels.length) labels.push('limpio');

        const row = {
          id: uid('insp'),
          at: nowIso(),
          mode: Edge.mode,
          plantId: opts.plantId || 'PLT-001',
          sector: opts.sector || 'Sector A',
          source: opts.source || (Edge.mode === 'DEMO' ? 'simulated_camera' : 'camera_api'),
          model: cfg.model,
          score: score,
          threshold: cfg.threshold,
          labels: labels,
          imageRef: opts.imageRef || null,
          notes: opts.notes || (Edge.mode === 'DEMO' ? 'Inferencia sintética (stub). Reemplazar por modelo CV real.' : 'Pendiente modelo desplegado')
        };

        const list = load(STORAGE.inspections, []);
        list.unshift(row);
        save(STORAGE.inspections, list.slice(0, 200));

        cfg.lastRun = row.at;
        cfg.nextRun = new Date(Date.now() + (cfg.intervalMs || INTERVAL_17H_MS)).toISOString();
        save(STORAGE.vision, cfg);

        Edge.emit('INSPECTION', row);
        if (hit) {
          Edge.emit('ALARM', {
            level: score > 0.75 ? 'ADVERTENCIA' : 'NORMAL',
            message: 'Visión: ' + labels.join(', ') + ' score=' + score,
            inspectionId: row.id
          });
        }
        return row;
      },
      list: function () {
        return load(STORAGE.inspections, []);
      },
      /**
       * Temporizador 17 h en navegador (para demo).
       * En producción usar systemd/cron en servidor de planta.
       */
      _timer: null,
      startScheduler: function () {
        const cfg = Edge.vision.getConfig();
        if (!cfg.enabled) return;
        if (this._timer) clearInterval(this._timer);
        // Chequeo cada 60s si toca correr (persiste nextRun)
        if (!cfg.nextRun) {
          cfg.nextRun = new Date(Date.now() + (cfg.intervalMs || INTERVAL_17H_MS)).toISOString();
          save(STORAGE.vision, cfg);
        }
        this._timer = setInterval(function () {
          const c = Edge.vision.getConfig();
          if (!c.enabled || !c.nextRun) return;
          if (Date.now() >= new Date(c.nextRun).getTime()) {
            Edge.vision.runInspection({ source: 'scheduler_17h' });
          }
        }, 60000);
        Edge.emit('VISION_SCHEDULER', { started: true, nextRun: cfg.nextRun });
      },
      runNow: function () {
        return this.runInspection({ source: 'manual' });
      }
    },

    /**
     * Video termográfico — configuración de stream.
     * DEMO: placeholder. FIELD: URL RTSP/HLS/MJPG del gateway.
     */
    thermal: {
      getConfig: function () {
        return load(STORAGE.thermal, {
          enabled: false,
          protocol: 'HLS',
          url: '',
          rtspUrl: '',
          overlayAi: true,
          note: 'Sin feed en vivo hasta configurar URL de stream o gateway.'
        });
      },
      setConfig: function (cfg) {
        const next = Object.assign({}, this.getConfig(), cfg || {});
        save(STORAGE.thermal, next);
        Edge.emit('THERMAL_CONFIG', next);
        return next;
      }
    },

    status: function () {
      return {
        version: this.version,
        mode: this.mode,
        events: load(STORAGE.events, []).length,
        shutdowns: load(STORAGE.shutdowns, []).length,
        inspections: load(STORAGE.inspections, []).length,
        vision: this.vision.getConfig(),
        thermal: this.thermal.getConfig(),
        industrial: this.industrial
      };
    }
  };

  // Auto-start scheduler visión en páginas que carguen edge-core
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      try { Edge.vision.startScheduler(); } catch (e) {}
    });
  }

  global.AEROVOLT_EDGE = Edge;
})(typeof window !== 'undefined' ? window : global);
