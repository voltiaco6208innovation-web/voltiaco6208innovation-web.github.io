/**
 * AEROVOLT Operations engines
 * Aerovolt3DController · InspectionPrioritySystem · CrawlerFleetController
 * DEMO-ready; hooks to edge-core / localStorage
 */
(function (global) {
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  class Aerovolt3DController {
    constructor() {
      this.waterLevel = 73;
      this.lightIntensity = 850;
      this.soilingIndex = 22;
      this.cleaningPriority = [];
      this.tanks = [
        { id: 'TANK-A', capacity: 5000, current: 3800, flowRate: 12 },
        { id: 'TANK-B', capacity: 5000, current: 3500, flowRate: 10 }
      ];
      this.panels = this._seedPanels();
    }

    _seedPanels() {
      const rows = [];
      for (let i = 1; i <= 24; i++) {
        rows.push({
          id: 'P-' + String(i).padStart(3, '0'),
          area: 2.2,
          soilingIndex: +(Math.random() * 55).toFixed(1),
          powerLoss: +(Math.random() * 18).toFixed(1),
          wPerM2: 700 + Math.round(Math.random() * 250),
          efficiency: +(0.15 + Math.random() * 0.05).toFixed(3),
          row: 'R' + Math.ceil(i / 6),
          location: { x: (i % 6) * 4, y: Math.floor((i - 1) / 6) * 8 }
        });
      }
      return rows;
    }

    updateWaterLevels(tankData) {
      if (tankData && tankData.length) this.tanks = tankData;
      const cur = this.tanks.reduce(function (a, t) { return a + t.current; }, 0);
      const cap = this.tanks.reduce(function (a, t) { return a + t.capacity; }, 0);
      this.waterLevel = cap ? (cur / cap) * 100 : 0;
      const waterColor = this.waterLevel > 70 ? '#00e676' : this.waterLevel > 40 ? '#ffb300' : '#ff5252';
      this.render3DTanks(waterColor, this.waterLevel);
      return { waterLevel: this.waterLevel, waterColor: waterColor, tanks: this.tanks };
    }

    render3DTanks(color, level) {
      const el = document.getElementById('metric-water');
      if (el) {
        el.textContent = level.toFixed(0);
        el.style.color = color;
      }
      const bar = document.getElementById('water-bar');
      if (bar) {
        bar.style.width = clamp(level, 0, 100) + '%';
        bar.style.background = color;
      }
    }

    updateLightMap(irradianceData) {
      const data = irradianceData || this.panels.map(function (p) {
        return { panelId: p.id, wPerM2: p.wPerM2, efficiency: p.efficiency };
      });
      this.lightIntensity = data.reduce(function (a, p) { return a + p.wPerM2; }, 0) / Math.max(data.length, 1);
      const lightGradient = this.calculateLightGradient(data);
      this.render3DLightMap(lightGradient);
      return { lightIntensity: this.lightIntensity, gradient: lightGradient };
    }

    calculateLightGradient(data) {
      return data.map(function (p) {
        const t = clamp(p.wPerM2 / 1100, 0, 1);
        return {
          panelId: p.panelId,
          wPerM2: p.wPerM2,
          color: t > 0.75 ? '#00e676' : t > 0.45 ? '#00d4ff' : t > 0.25 ? '#ffb300' : '#ff5252'
        };
      });
    }

    render3DLightMap(gradient) {
      const el = document.getElementById('metric-irr');
      if (el) el.textContent = Math.round(this.lightIntensity);
      const box = document.getElementById('light-map');
      if (!box) return;
      box.innerHTML = gradient.slice(0, 24).map(function (g) {
        return '<span title="' + g.panelId + ' ' + g.wPerM2 + ' W/m²" style="background:' + g.color + '"></span>';
      }).join('');
    }

    calculateCleaningPriority() {
      const waterBoost = this.waterLevel > 50 ? 0.2 : 0;
      const priority = this.panels.map(function (panel) {
        return {
          id: panel.id,
          row: panel.row,
          score: +(panel.soilingIndex * 0.4 + panel.powerLoss * 0.4 + waterBoost * 20).toFixed(2),
          soilingIndex: panel.soilingIndex,
          powerLoss: panel.powerLoss,
          estimatedWaterNeed: +(panel.area * 2.5).toFixed(1),
          needsWater: panel.soilingIndex > 35,
          location: panel.location
        };
      });
      priority.sort(function (a, b) { return b.score - a.score; });
      this.cleaningPriority = priority;
      this.soilingIndex = priority.reduce(function (a, p) { return a + p.soilingIndex; }, 0) / priority.length;
      return priority;
    }
  }

  class InspectionPrioritySystem {
    constructor(map3d) {
      this.map3d = map3d || new Aerovolt3DController();
      this.thermalCamera = { model: 'FLIR-A700-SIM', online: true };
      this.visionAI = { model: 'soiling-bird-v1-stub', online: true };
      this.priorityQueue = [];
    }

    detectThermalHotspots() {
      const hotspots = [];
      this.map3d.panels.forEach(function (p) {
        if (Math.random() > 0.88) {
          hotspots.push({
            panelId: p.id,
            tempDelta: +(4 + Math.random() * 12).toFixed(1),
            severity: Math.random() > 0.5 ? 'HIGH' : 'MED'
          });
        }
      });
      return {
        hotspots: hotspots,
        defectiveDiodes: hotspots.filter(function (h) { return h.tempDelta > 12; }).map(function (h) { return h.panelId; }),
        pidAffected: []
      };
    }

    detectSoilingRGB() {
      return this.map3d.panels.map(function (p) {
        return { panelId: p.id, soilingIndex: p.soilingIndex, row: p.row };
      });
    }

    calculatePriorityMatrix(thermal, soiling) {
      const thermalMap = {};
      (thermal.hotspots || []).forEach(function (h) { thermalMap[h.panelId] = h; });
      return soiling.map(function (s) {
        const th = thermalMap[s.panelId];
        const thermalScore = th ? th.tempDelta * 2 : 0;
        return {
          id: s.panelId,
          row: s.row,
          soilingIndex: s.soilingIndex,
          thermal: th || null,
          score: +(s.soilingIndex * 0.5 + thermalScore * 0.5).toFixed(2),
          needsWater: s.soilingIndex > 35,
          area: 2.2
        };
      }).sort(function (a, b) { return b.score - a.score; });
    }

    generateWorkQueue(matrix) {
      return matrix.filter(function (m) { return m.score > 25; }).slice(0, 12);
    }

    async runPrioritizedInspection() {
      const thermalAnomalies = this.detectThermalHotspots();
      const soilingMap = this.detectSoilingRGB();
      const priorityMatrix = this.calculatePriorityMatrix(thermalAnomalies, soilingMap);
      this.priorityQueue = this.generateWorkQueue(priorityMatrix);

      if (global.AEROVOLT_EDGE && AEROVOLT_EDGE.vision) {
        AEROVOLT_EDGE.vision.runInspection({
          source: 'priority_engine',
          notes: 'Inspección priorizada térmica+RGB',
          score: this.priorityQueue[0] ? this.priorityQueue[0].score / 100 : 0.2
        });
      }

      const result = {
        at: new Date().toISOString(),
        thermal: thermalAnomalies,
        queue: this.priorityQueue,
        water: this.map3d.updateWaterLevels(),
        light: this.map3d.updateLightMap()
      };
      localStorage.setItem('aerovolt_priority_queue', JSON.stringify(this.priorityQueue));
      localStorage.setItem('aerovolt_last_inspection_run', JSON.stringify(result));
      return result;
    }

    dispatchToRobots(queue) {
      if (global.AEROVOLT_CRAWLERS) {
        return AEROVOLT_CRAWLERS.assignMissionsFromInspection(queue || this.priorityQueue);
      }
      return [];
    }
  }

  class CrawlerFleetController {
    constructor() {
      this.fleet = [];
      this.missionQueue = [];
      this.waterConstraints = { minLevelPct: 25, maxWindSpeed: 50 };
      this.safetyRules = {
        maxWindSpeed: 50,
        minTemperature: -10,
        maxTemperature: 50,
        rainDetection: true
      };
      this._seedDemoFleet();
    }

    _seedDemoFleet() {
      if (this.fleet.length) return;
      this.fleet = [
        { id: 'CRW-01', position: { x: 0, y: 0, row: 'R1' }, battery: 92, waterLevel: 80, status: 'IDLE', currentMission: null },
        { id: 'CRW-02', position: { x: 12, y: 8, row: 'R2' }, battery: 67, waterLevel: 55, status: 'IDLE', currentMission: null }
      ];
    }

    async connectRobotAPI(robotConfig) {
      const robot = {
        id: robotConfig.id,
        position: { x: 0, y: 0, row: null },
        battery: 100,
        waterLevel: 100,
        status: 'IDLE',
        currentMission: null,
        sdkEndpoint: robotConfig.sdkEndpoint || null,
        type: robotConfig.type || 'TRACKED_CLEANER'
      };
      this.fleet.push(robot);
      return robot;
    }

    generateNavigableMap(plantLayout) {
      const rows = (plantLayout && plantLayout.rows) || [
        { id: 'R1', center: { x: 0, y: 0 }, accessPoints: [1] },
        { id: 'R2', center: { x: 0, y: 8 }, accessPoints: [1] },
        { id: 'R3', center: { x: 0, y: 16 }, accessPoints: [1] },
        { id: 'R4', center: { x: 0, y: 24 }, accessPoints: [1] }
      ];
      return {
        nodes: rows.map(function (row) {
          return {
            id: row.id,
            x: row.center.x,
            y: row.center.y,
            accessible: (row.accessPoints || []).length > 0
          };
        }),
        edges: [
          { from: 'R1', to: 'R2' },
          { from: 'R2', to: 'R3' },
          { from: 'R3', to: 'R4' }
        ]
      };
    }

    selectOptimalRobot(location) {
      const idle = this.fleet.filter(function (r) { return r.status === 'IDLE' && r.battery > 20; });
      if (!idle.length) return null;
      return idle.sort(function (a, b) { return b.battery - a.battery; })[0].id;
    }

    assignMissionsFromInspection(priorityQueue) {
      const self = this;
      const missions = (priorityQueue || []).slice(0, 8).map(function (panel, index) {
        return {
          id: 'M' + Date.now() + '-' + index,
          type: panel.needsWater ? 'WET_CLEANING' : 'DRY_CLEANING',
          targetPanel: panel.id,
          estimatedDuration: (panel.area || 2.2) * 0.5,
          waterRequired: panel.needsWater ? (panel.area || 2.2) * 2.5 : 0,
          priority: panel.score,
          assignedRobot: self.selectOptimalRobot(panel.location),
          status: 'QUEUED'
        };
      });
      this.missionQueue = missions.concat(this.missionQueue).slice(0, 40);
      localStorage.setItem('aerovolt_missions', JSON.stringify(this.missionQueue));
      this.executeNextMissions();
      return missions;
    }

    executeNextMissions() {
      const self = this;
      this.missionQueue.forEach(function (m) {
        if (m.status !== 'QUEUED' || !m.assignedRobot) return;
        const robot = self.fleet.find(function (r) { return r.id === m.assignedRobot; });
        if (!robot || robot.status !== 'IDLE') return;
        robot.status = 'WORKING';
        robot.currentMission = m.id;
        m.status = 'ASSIGNED_DEMO';
      });
      localStorage.setItem('aerovolt_fleet', JSON.stringify(this.fleet));
      localStorage.setItem('aerovolt_missions', JSON.stringify(this.missionQueue));
    }

    emergencyStop() {
      this.fleet.forEach(function (r) {
        r.status = 'ERROR';
        r.currentMission = null;
      });
      this.missionQueue.forEach(function (m) {
        if (m.status === 'ASSIGNED_DEMO' || m.status === 'QUEUED') m.status = 'STOPPED';
      });
      localStorage.setItem('aerovolt_fleet', JSON.stringify(this.fleet));
      if (global.AEROVOLT_EDGE) AEROVOLT_EDGE.emit('CRAWLER_ESTOP', { at: new Date().toISOString() });
    }

    status() {
      return { fleet: this.fleet, missions: this.missionQueue, safety: this.safetyRules };
    }
  }

  const map3d = new Aerovolt3DController();
  const inspection = new InspectionPrioritySystem(map3d);
  const crawlers = new CrawlerFleetController();

  global.Aerovolt3DController = Aerovolt3DController;
  global.InspectionPrioritySystem = InspectionPrioritySystem;
  global.CrawlerFleetController = CrawlerFleetController;
  global.AEROVOLT_3D = map3d;
  global.AEROVOLT_INSPECTION = inspection;
  global.AEROVOLT_CRAWLERS = crawlers;
})(typeof window !== 'undefined' ? window : global);
