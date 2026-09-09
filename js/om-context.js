/** AEROVOLT O&M — contexto de navegación compartido (plant/sector/equipment) */
(function (g) {
  const KEY = 'aerovolt_om_ctx';
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function save(ctx) { localStorage.setItem(KEY, JSON.stringify(ctx)); }
  const Ctx = {
    get: function () {
      const c = load();
      return {
        plantId: c.plantId || 'PLT-001',
        sector: c.sector || 'ALL',
        equipmentId: c.equipmentId || null,
        source: 'DEMO'
      };
    },
    set: function (partial) {
      const next = Object.assign({}, this.get(), partial || {});
      save(next);
      return next;
    },
    setPlant: function (id) { return this.set({ plantId: id, sector: 'ALL', equipmentId: null }); },
    setSector: function (s) { return this.set({ sector: s, equipmentId: null }); },
    setEquipment: function (id) { return this.set({ equipmentId: id }); }
  };
  g.AEROVOLT_CTX = Ctx;
})(typeof window !== 'undefined' ? window : global);
