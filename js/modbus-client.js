/**
 * AEROVOLT Modbus client (capa web)
 * DEMO: simula coils/holding y actualiza AEROVOLT.inverters
 * FIELD: HTTP al gateway (no socket 502 desde el browser)
 */
(function (global) {
  const STORE_KEY = 'aerovolt_modbus_cfg';
  const SIM_KEY = 'aerovolt_modbus_sim';

  function load(key, fb) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : fb;
    } catch (e) {
      return fb;
    }
  }
  function save(key, v) {
    localStorage.setItem(key, JSON.stringify(v));
  }
  function map() {
    return global.AEROVOLT_MODBUS_MAP || { devices: [], emergency: { address: 0 }, statusCodes: {} };
  }

  const Client = {
    version: '1.1.0',

    getConfig: function () {
      return load(STORE_KEY, {
        gatewayUrl: '',
        token: '',
        pollIntervalMs: 4000,
        useSimWhenNoGateway: true
      });
    },

    setConfig: function (cfg) {
      const next = Object.assign({}, this.getConfig(), cfg || {});
      save(STORE_KEY, next);
      if (global.AEROVOLT_EDGE) {
        const d0 = (map().devices || [])[0] || {};
        AEROVOLT_EDGE.configureIndustrial({
          webhookUrl: next.gatewayUrl ? next.gatewayUrl.replace(/\/$/, '') + '/api/shutdown' : next.gatewayUrl,
          modbus: {
            enabled: true,
            host: d0.host || '',
            unitId: (map().defaults && map().defaults.unitId) || 1,
            coilShutdown: (map().emergency && map().emergency.address) || 0
          }
        });
      }
      return next;
    },

    getSim: function () {
      let sim = load(SIM_KEY, null);
      if (sim) return sim;
      sim = { coils: {}, holding: {}, updatedAt: new Date().toISOString() };
      (map().devices || []).forEach(function (d) {
        sim.coils[d.id] = { 0: false };
        sim.holding[d.id] = {};
        (d.registers || []).forEach(function (reg) {
          var defaults = {
            power_kw: 780, dc_v: 6120, dc_a: 1280, ac_v: 4800, ac_a: 940,
            freq: 6000, status_code: 0, alarm_code: 0
          };
          sim.holding[d.id][reg.address] = defaults[reg.key] != null ? defaults[reg.key] : 0;
        });
      });
      save(SIM_KEY, sim);
      return sim;
    },

    saveSim: function (sim) {
      sim.updatedAt = new Date().toISOString();
      save(SIM_KEY, sim);
    },

    decode: function (reg, raw) {
      return raw * (reg.scale != null ? reg.scale : 1) + (reg.offset != null ? reg.offset : 0);
    },

    readDevice: async function (deviceId) {
      var self = this;
      var dev = (map().devices || []).find(function (d) { return d.id === deviceId; });
      if (!dev) return { ok: false, error: 'device no encontrado' };
      var cfg = this.getConfig();
      var mode = (global.AEROVOLT_EDGE && AEROVOLT_EDGE.mode) || 'DEMO';

      if (mode === 'FIELD' && cfg.gatewayUrl) {
        try {
          var res = await fetch(cfg.gatewayUrl.replace(/\/$/, '') + '/modbus/read', {
            method: 'POST',
            headers: Object.assign(
              { 'Content-Type': 'application/json' },
              cfg.token ? { Authorization: 'Bearer ' + cfg.token } : {}
            ),
            body: JSON.stringify({ device: dev })
          });
          var data = await res.json();
          if (res.ok) {
            self.applyToAerovolt(deviceId, data.values || {});
            return { ok: true, source: 'gateway', deviceId: deviceId, values: data.values, raw: data.raw };
          }
          return { ok: false, error: data.error || 'gateway error', http: res.status };
        } catch (e) {
          if (!cfg.useSimWhenNoGateway) return { ok: false, error: String(e.message || e) };
        }
      }

      var sim = this.getSim();
      var values = {};
      var raw = {};
      (dev.registers || []).forEach(function (reg) {
        var r = (sim.holding[deviceId] && sim.holding[deviceId][reg.address]) || 0;
        raw[reg.key] = r;
        values[reg.key] = self.decode(reg, r);
      });
      var coilAddr = (map().emergency && map().emergency.address) || 0;
      values._coil_emergency = !!(sim.coils[deviceId] && sim.coils[deviceId][coilAddr]);
      this.applyToAerovolt(deviceId, values);
      return { ok: true, source: 'sim', deviceId: deviceId, values: values, raw: raw };
    },

    readAll: async function () {
      var out = [];
      var devices = map().devices || [];
      for (var i = 0; i < devices.length; i++) out.push(await this.readDevice(devices[i].id));
      return out;
    },

    writeEmergency: async function (opts) {
      opts = opts || {};
      var equipmentId = opts.equipmentId || 'ALL';
      var value = opts.value !== false;
      var em = map().emergency || { address: 0 };
      var cfg = this.getConfig();
      var mode = (global.AEROVOLT_EDGE && AEROVOLT_EDGE.mode) || 'DEMO';
      var targets = (map().devices || []).filter(function (d) {
        return equipmentId === 'ALL' || d.id === equipmentId;
      });

      if (mode === 'FIELD' && cfg.gatewayUrl) {
        try {
          var res = await fetch(cfg.gatewayUrl.replace(/\/$/, '') + '/modbus/emergency', {
            method: 'POST',
            headers: Object.assign(
              { 'Content-Type': 'application/json' },
              cfg.token ? { Authorization: 'Bearer ' + cfg.token } : {}
            ),
            body: JSON.stringify({
              equipmentId: equipmentId,
              devices: targets,
              emergency: em,
              value: value,
              reason: opts.reason || '',
              operator: opts.operator || ''
            })
          });
          var data = await res.json();
          return { ok: res.ok, source: 'gateway', data: data };
        } catch (e) {
          return { ok: false, error: String(e.message || e) };
        }
      }

      var sim = this.getSim();
      var self = this;
      targets.forEach(function (d) {
        if (!sim.coils[d.id]) sim.coils[d.id] = {};
        sim.coils[d.id][em.address || 0] = value;
        if (!sim.holding[d.id]) sim.holding[d.id] = {};
        var st = (d.registers || []).find(function (r) { return r.key === 'status_code'; });
        var pw = (d.registers || []).find(function (r) { return r.key === 'power_kw'; });
        if (st) sim.holding[d.id][st.address] = value ? 3 : 0;
        if (pw && value) sim.holding[d.id][pw.address] = 0;
      });
      this.saveSim(sim);
      targets.forEach(function (d) {
        self.applyToAerovolt(d.id, { power_kw: value ? 0 : undefined, status_code: value ? 3 : 0, _coil_emergency: value });
      });
      if (global.AEROVOLT_EDGE) {
        AEROVOLT_EDGE.emit('MODBUS_WRITE', { type: 'emergency_coil', equipmentId: equipmentId, value: value, source: 'sim' });
      }
      return { ok: true, source: 'sim', targets: targets.map(function (t) { return t.id; }) };
    },

    applyToAerovolt: function (deviceId, values) {
      if (!global.AEROVOLT || !AEROVOLT.inverters) return;
      var inv = AEROVOLT.inverters.find(function (i) { return i.id === deviceId; });
      if (!inv) return;
      if (values.power_kw != null) inv.power_kw = +Number(values.power_kw).toFixed(1);
      if (values.dc_v != null) inv.dc_v = Math.round(values.dc_v);
      if (values.dc_a != null) inv.dc_a = Math.round(values.dc_a);
      if (values.ac_v != null) inv.ac_v = Math.round(values.ac_v);
      if (values.ac_a != null) inv.ac_a = Math.round(values.ac_a);
      if (values.freq != null) inv.freq = +Number(values.freq).toFixed(2);
      var codes = map().statusCodes || {};
      if (values.status_code != null && codes[values.status_code] != null) inv.status = codes[values.status_code];
      if (values._coil_emergency) {
        inv.status = 'CRITICO';
        inv.power_kw = 0;
        inv.alarm = 'EMERGENCY COIL ACTIVE';
      }
      inv.last_comm_s = 1;
      inv._modbusAt = new Date().toISOString();
    },

    tickSim: function () {
      var sim = this.getSim();
      var coilAddr = (map().emergency && map().emergency.address) || 0;
      (map().devices || []).forEach(function (d) {
        if (sim.coils[d.id] && sim.coils[d.id][coilAddr]) return;
        var pw = (d.registers || []).find(function (r) { return r.key === 'power_kw'; });
        if (pw && sim.holding[d.id]) {
          var cur = sim.holding[d.id][pw.address] || 0;
          sim.holding[d.id][pw.address] = Math.max(0, cur + Math.round((Math.random() - 0.5) * 20));
        }
      });
      this.saveSim(sim);
    },

    _pollTimer: null,
    startPolling: function (onTick) {
      var self = this;
      var cfg = this.getConfig();
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(async function () {
        if (!(global.AEROVOLT_EDGE && AEROVOLT_EDGE.mode === 'FIELD')) self.tickSim();
        var results = await self.readAll();
        if (typeof onTick === 'function') onTick(results);
        if (global.AEROVOLT_EDGE) AEROVOLT_EDGE.emit('MODBUS_POLL', { count: results.length });
      }, cfg.pollIntervalMs || 4000);
    },

    stopPolling: function () {
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  };

  function hookEdge() {
    if (!global.AEROVOLT_EDGE || AEROVOLT_EDGE._modbusHooked) return;
    AEROVOLT_EDGE._modbusHooked = true;
    var orig = AEROVOLT_EDGE.emergencyShutdown.bind(AEROVOLT_EDGE);
    AEROVOLT_EDGE.emergencyShutdown = async function (opts) {
      var res = await orig(opts);
      if (res && res.ok) {
        await Client.writeEmergency({
          equipmentId: (opts && opts.equipmentId) || 'ALL',
          reason: (opts && opts.reason) || '',
          operator: (opts && opts.operator) || '',
          value: true
        });
      }
      return res;
    };
  }
  hookEdge();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', hookEdge);
  }

  global.AEROVOLT_MODBUS = Client;
})(typeof window !== 'undefined' ? window : global);
