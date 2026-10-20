import { deriveEnergyPolicy } from "./energy-policy.js";

const STORAGE_KEY = "cv_station_telemetry_v1";
const HISTORY_KEY = "cv_station_telemetry_history_v1";
const CHANNEL_NAME = "campusvolt_telemetry_channel";
const MAX_HISTORY_POINTS = 180;

export const DEFAULT_TELEMETRY = Object.freeze({
  version: 1,
  source: "simulation",
  scenario: "sunny",
  battery: {
    chemistry: "LiFePO4",
    ratedVoltage: 12.8,
    ratedCapacityAh: 100,
    ratedEnergyWh: 1280,
    soc: 85,
    voltage: 13.36,
    currentA: 14.6,
    powerW: 195,
    remainingAh: 85,
    remainingEnergyWh: 1088,
    temperatureC: 30,
    healthPercent: 98,
    cycleCount: 42,
    status: "charging",
    protection: "normal",
    cellMinVoltage: 3.33,
    cellMaxVoltage: 3.35,
    cellDeltaMv: 20,
    estimatedMinutesToFull: 66,
    estimatedRuntimeMinutes: null,
  },
  solar: {
    powerW: 285,
    energyTodayWh: 1800,
    peakPowerW: 450,
    panelVoltage: 18.6,
    controllerState: "charging",
  },
  load: {
    totalPowerW: 90,
    outputPowerW: 90,
    demandPowerW: 90,
    outputEnergyTodayWh: 520,
    activePorts: 0,
    totalPorts: 6,
    source: "simulation-estimate",
    ac: {
      voltageV: 220,
      currentA: 0.25,
      powerW: 54,
    },
    dc: {
      voltageV: 5,
      currentA: 7.2,
      powerW: 36,
    },
  },
  weather: {
    forecast: "high",
    expectedSolarW: 340,
    source: "simulation",
    retrievedAt: Date.now(),
  },
  energyManagement: {
    mode: "normal-mode",
    expectedMode: "normal-mode",
    decisionMatchesExpected: true,
    safetyState: "normal",
    controller: "rule-based-demo",
    maxLoadW: 456,
    reason: "No Conservation or Survival Eco trigger is active, so full service remains available.",
  },
  system: {
    connected: true,
    bmsConnected: true,
    running: false,
    speed: 60,
    sequence: 0,
    messageId: "SIM-000000",
    transmittedAt: Date.now(),
    receivedAt: Date.now(),
    latencyMs: 0,
    updatedAt: Date.now(),
  },
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDeep(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeDeep(target?.[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalize(snapshot) {
  const normalized = mergeDeep(clone(DEFAULT_TELEMETRY), snapshot || {});
  const suppliedLoad = snapshot?.load;

  // Migrate telemetry saved before output-side voltage/current fields existed.
  if (suppliedLoad && !Number.isFinite(Number(suppliedLoad.outputPowerW))) {
    const outputPowerW = Math.max(0, Number(normalized.load.totalPowerW) || 0);
    const acPowerW = outputPowerW * 0.6;
    const dcPowerW = outputPowerW - acPowerW;
    normalized.load.demandPowerW = outputPowerW;
    normalized.load.outputPowerW = outputPowerW;
    normalized.load.ac = {
      voltageV: outputPowerW > 0 ? 220 : 0,
      currentA: Number((acPowerW / 220).toFixed(2)),
      powerW: Number(acPowerW.toFixed(1)),
    };
    normalized.load.dc = {
      voltageV: outputPowerW > 0 ? 5 : 0,
      currentA: Number((dcPowerW / 5).toFixed(2)),
      powerW: Number(dcPowerW.toFixed(1)),
    };
  }

  normalized.energyManagement = {
    ...normalized.energyManagement,
    ...deriveEnergyPolicy(normalized),
  };

  return normalized;
}

class TelemetryStore extends EventTarget {
  constructor() {
    super();
    this.channel = null;
    this.snapshot = this._load();

    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.addEventListener("message", (event) => {
          if (event.data?.type !== "telemetry-updated") return;
          this.snapshot = normalize(event.data.snapshot);
          this._emit();
        });
      } catch {
        this.channel = null;
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        try {
          this.snapshot = normalize(JSON.parse(event.newValue));
          this._emit();
        } catch {
          // Ignore incomplete writes from another tab.
        }
      });
    }
  }

  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalize(JSON.parse(saved)) : clone(DEFAULT_TELEMETRY);
    } catch {
      return clone(DEFAULT_TELEMETRY);
    }
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("telemetry-changed", {
      detail: { snapshot: this.getSnapshot() },
    }));
  }

  getSnapshot() {
    return clone(this.snapshot);
  }

  setSnapshot(nextSnapshot, { recordHistory = true, broadcast = true } = {}) {
    this.snapshot = normalize(nextSnapshot);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
      if (recordHistory) this._recordHistory(this.snapshot);
    } catch (error) {
      console.warn("CampusVolt: telemetry could not be saved locally.", error);
    }

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: "telemetry-updated",
        snapshot: this.snapshot,
      });
    }

    this._emit();
    return this.getSnapshot();
  }

  update(patch, options) {
    return this.setSnapshot(mergeDeep(this.snapshot, patch), options);
  }

  reset() {
    return this.setSnapshot(clone(DEFAULT_TELEMETRY));
  }

  _recordHistory(snapshot) {
    try {
      const history = this.getHistory();
      history.push({
        timestamp: snapshot.system.updatedAt,
        soc: snapshot.battery.soc,
        batteryPowerW: snapshot.battery.powerW,
        solarPowerW: snapshot.solar.powerW,
        loadPowerW: snapshot.load.totalPowerW,
        outputPowerW: snapshot.load.outputPowerW,
        acVoltageV: snapshot.load.ac.voltageV,
        acCurrentA: snapshot.load.ac.currentA,
        dcVoltageV: snapshot.load.dc.voltageV,
        dcCurrentA: snapshot.load.dc.currentA,
        temperatureC: snapshot.battery.temperatureC,
        mode: snapshot.energyManagement.mode,
        expectedMode: snapshot.energyManagement.expectedMode,
        decisionMatchesExpected: snapshot.energyManagement.decisionMatchesExpected,
        safetyState: snapshot.energyManagement.safetyState,
        scenario: snapshot.scenario,
        weatherForecast: snapshot.weather.forecast,
        weatherRetrievedAt: snapshot.weather.retrievedAt,
        messageId: snapshot.system.messageId,
        transmittedAt: snapshot.system.transmittedAt,
        receivedAt: snapshot.system.receivedAt,
        latencyMs: snapshot.system.latencyMs,
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY_POINTS)));
    } catch {
      // History is useful for the demo, but telemetry should continue without it.
    }
  }

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }
}

export const telemetryStore = new TelemetryStore();
