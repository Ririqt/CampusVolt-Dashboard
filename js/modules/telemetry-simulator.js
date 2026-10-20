import { DEFAULT_TELEMETRY, telemetryStore } from "./telemetry-store.js?v=4";
import { deriveEnergyPolicy } from "./energy-policy.js?v=4";

export const SIMULATION_SCENARIOS = Object.freeze({
  sunny: {
    label: "Sunny charging",
    description: "Strong generation charges the battery while all ports remain available.",
    solarPowerW: 360,
    loadPowerW: 95,
    soc: 72,
    temperatureC: 30,
    connected: true,
    protection: "normal",
    weatherForecast: "high",
    expectedSolarW: 340,
    expectedMode: "normal-mode",
  },
  cloudy: {
    label: "Cloudy operation",
    description: "Reduced solar output is monitored while the healthy battery reserve keeps Normal Mode active.",
    solarPowerW: 105,
    loadPowerW: 135,
    soc: 58,
    temperatureC: 29,
    connected: true,
    protection: "normal",
    weatherForecast: "low",
    expectedSolarW: 90,
    expectedMode: "normal-mode",
  },
  evening: {
    label: "Evening discharge",
    description: "The battery carries the station in Conservation Mode after solar generation falls away.",
    solarPowerW: 0,
    loadPowerW: 110,
    soc: 48,
    temperatureC: 31,
    connected: true,
    protection: "normal",
    weatherForecast: "none",
    expectedSolarW: 0,
    expectedMode: "conservation-mode",
  },
  lowBattery: {
    label: "Low battery",
    description: "Survival Eco Mode restricts high-power charging to preserve the battery reserve.",
    solarPowerW: 35,
    loadPowerW: 90,
    soc: 24,
    temperatureC: 30,
    connected: true,
    protection: "normal",
    weatherForecast: "low",
    expectedSolarW: 70,
    expectedMode: "survival-eco-mode",
  },
  criticalBattery: {
    label: "Critical battery cutoff",
    description: "SoC below 10% activates the paper's strict safety cutoff while monitoring continues.",
    solarPowerW: 20,
    loadPowerW: 65,
    soc: 8,
    temperatureC: 29,
    connected: true,
    protection: "normal",
    weatherForecast: "low",
    expectedSolarW: 60,
    expectedMode: "survival-eco-mode",
  },
  overheating: {
    label: "High temperature",
    description: "A thermal alarm demonstrates the charging safety shutdown.",
    solarPowerW: 250,
    loadPowerW: 145,
    soc: 64,
    temperatureC: 58,
    connected: true,
    protection: "high-temperature",
    weatherForecast: "moderate",
    expectedSolarW: 220,
    expectedMode: "normal-mode",
  },
  disconnected: {
    label: "BMS disconnected",
    description: "Telemetry becomes unavailable and the kiosk enters a safe hold.",
    solarPowerW: 180,
    loadPowerW: 70,
    soc: 64,
    temperatureC: 30,
    connected: false,
    protection: "unknown",
    weatherForecast: "moderate",
    expectedSolarW: 180,
    expectedMode: "normal-mode",
  },
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => Number(value.toFixed(digits));

export class TelemetrySimulator extends EventTarget {
  constructor(store = telemetryStore) {
    super();
    this.store = store;
    this.timerId = null;
    this.targets = {
      solarPowerW: DEFAULT_TELEMETRY.solar.powerW,
      loadPowerW: DEFAULT_TELEMETRY.load.totalPowerW,
    };
  }

  applyScenario(name) {
    const scenario = SIMULATION_SCENARIOS[name];
    if (!scenario) return;

    this.targets.solarPowerW = scenario.solarPowerW;
    this.targets.loadPowerW = scenario.loadPowerW;

    const current = this.store.getSnapshot();
    const next = {
      ...current,
      source: "simulation",
      scenario: name,
      battery: {
        ...current.battery,
        soc: scenario.soc,
        temperatureC: scenario.temperatureC,
        protection: scenario.protection,
      },
      solar: {
        ...current.solar,
        powerW: scenario.solarPowerW,
      },
      load: {
        ...current.load,
        totalPowerW: scenario.loadPowerW,
      },
      system: {
        ...current.system,
        connected: scenario.connected,
        bmsConnected: scenario.connected,
        updatedAt: Date.now(),
      },
      weather: {
        ...current.weather,
        forecast: scenario.weatherForecast,
        expectedSolarW: scenario.expectedSolarW,
        source: "simulation",
        retrievedAt: Date.now(),
      },
    };

    this.store.setSnapshot(this._calculate(next, 0));
    this.dispatchEvent(new CustomEvent("scenario-changed", { detail: { name, scenario } }));
  }

  setInputs({ solarPowerW, loadPowerW }) {
    if (Number.isFinite(Number(solarPowerW))) {
      this.targets.solarPowerW = clamp(Number(solarPowerW), 0, 450);
    }
    if (Number.isFinite(Number(loadPowerW))) {
      this.targets.loadPowerW = clamp(Number(loadPowerW), 0, 456);
    }
    this.tick(0);
  }

  setWeatherForecast(forecast) {
    const allowed = new Set(["high", "moderate", "low", "none", "cached"]);
    if (!allowed.has(forecast)) return;
    const expectedByForecast = { high: 340, moderate: 220, low: 90, none: 0, cached: 180 };
    this.store.update({
      weather: {
        forecast,
        expectedSolarW: expectedByForecast[forecast],
        source: forecast === "cached" ? "cached-simulation" : "simulation",
        retrievedAt: Date.now(),
      },
    });
    this.tick(0);
  }

  start(speed = 60) {
    const safeSpeed = clamp(Number(speed) || 60, 1, 600);
    if (this.timerId) window.clearInterval(this.timerId);
    this.store.update({ system: { running: true, speed: safeSpeed, updatedAt: Date.now() } });
    this.timerId = window.setInterval(() => this.tick(safeSpeed), 1000);
    this.tick(0);
  }

  pause() {
    if (this.timerId) window.clearInterval(this.timerId);
    this.timerId = null;
    this.store.update({ system: { running: false, updatedAt: Date.now() } });
  }

  reset() {
    this.pause();
    this.store.clearHistory();
    this.store.reset();
    this.applyScenario("sunny");
  }

  tick(simulatedSeconds = 0) {
    const current = this.store.getSnapshot();
    const jitter = current.system.running ? (Math.random() - 0.5) * 8 : 0;
    const solarPowerW = clamp(this.targets.solarPowerW + jitter, 0, current.solar.peakPowerW);
    const loadPowerW = clamp(this.targets.loadPowerW + jitter * 0.35, 0, 456);
    const next = {
      ...current,
      solar: { ...current.solar, powerW: solarPowerW },
      load: { ...current.load, totalPowerW: loadPowerW },
      system: { ...current.system, updatedAt: Date.now() },
    };
    this.store.setSnapshot(this._calculate(next, simulatedSeconds));
  }

  _calculate(snapshot, simulatedSeconds) {
    const next = JSON.parse(JSON.stringify(snapshot));
    const { battery, solar, load, system } = next;
    const chargeEfficiency = 0.96;
    const inverterEfficiency = 0.9;
    const now = Date.now();

    system.sequence = (Number(system.sequence) || 0) + 1;
    system.messageId = `SIM-${String(system.sequence).padStart(6, "0")}`;
    system.latencyMs = Math.round(35 + Math.random() * 115);
    system.transmittedAt = now - system.latencyMs;
    system.receivedAt = now;
    system.updatedAt = now;

    const scenario = SIMULATION_SCENARIOS[next.scenario] || SIMULATION_SCENARIOS.sunny;

    const applyPolicy = () => {
      next.energyManagement = {
        ...deriveEnergyPolicy(next),
        expectedMode: scenario.expectedMode,
      };
      next.energyManagement.decisionMatchesExpected = next.energyManagement.mode === scenario.expectedMode;
    };

    if (!system.bmsConnected) {
      battery.status = "disconnected";
      battery.currentA = 0;
      battery.powerW = 0;
      battery.remainingAh = round(battery.ratedCapacityAh * battery.soc / 100, 1);
      battery.remainingEnergyWh = round(battery.ratedEnergyWh * battery.soc / 100, 1);
      battery.estimatedMinutesToFull = null;
      battery.estimatedRuntimeMinutes = null;
      applyPolicy();
      load.demandPowerW = round(load.totalPowerW, 1);
      load.outputPowerW = 0;
      load.source = "simulation-estimate";
      load.ac = { voltageV: 0, currentA: 0, powerW: 0 };
      load.dc = { voltageV: 0, currentA: 0, powerW: 0 };
      return next;
    }

    const netPowerW = solar.powerW - load.totalPowerW;
    const storedPowerW = netPowerW >= 0 ? netPowerW * chargeEfficiency : netPowerW / inverterEfficiency;
    const energyDeltaWh = storedPowerW * simulatedSeconds / 3600;
    let remainingEnergyWh = battery.ratedEnergyWh * battery.soc / 100 + energyDeltaWh;
    remainingEnergyWh = clamp(remainingEnergyWh, 0, battery.ratedEnergyWh);

    battery.remainingEnergyWh = round(remainingEnergyWh, 1);
    battery.soc = round(remainingEnergyWh / battery.ratedEnergyWh * 100, 1);
    battery.remainingAh = round(battery.ratedCapacityAh * battery.soc / 100, 1);
    battery.voltage = round(12.0 + 1.55 * battery.soc / 100 + clamp(netPowerW / 1200, -0.12, 0.12), 2);
    battery.currentA = round(netPowerW / Math.max(battery.voltage, 1), 2);
    battery.powerW = round(netPowerW, 1);
    battery.status = netPowerW > 5 ? "charging" : (netPowerW < -5 ? "discharging" : "idle");

    if (next.scenario !== "overheating") {
      const targetTemperature = scenario.temperatureC + Math.min(Math.abs(netPowerW) / 180, 3);
      battery.temperatureC = round(battery.temperatureC + (targetTemperature - battery.temperatureC) * 0.08, 1);
    }

    if (netPowerW > 5) {
      battery.estimatedMinutesToFull = Math.round((battery.ratedEnergyWh - remainingEnergyWh) / (netPowerW * chargeEfficiency) * 60);
      battery.estimatedRuntimeMinutes = null;
    } else if (netPowerW < -5) {
      battery.estimatedRuntimeMinutes = Math.round(remainingEnergyWh * inverterEfficiency / Math.abs(netPowerW) * 60);
      battery.estimatedMinutesToFull = null;
    } else {
      battery.estimatedMinutesToFull = null;
      battery.estimatedRuntimeMinutes = null;
    }

    applyPolicy();

    const deliveredPowerW = next.energyManagement.maxLoadW === 0
      ? 0
      : Math.min(load.totalPowerW, next.energyManagement.maxLoadW);
    const acPowerW = deliveredPowerW * 0.6;
    const dcPowerW = deliveredPowerW - acPowerW;
    load.demandPowerW = round(load.totalPowerW, 1);
    load.outputPowerW = round(deliveredPowerW, 1);
    load.outputEnergyTodayWh = round((Number(load.outputEnergyTodayWh) || 0) + deliveredPowerW * simulatedSeconds / 3600, 1);
    load.source = "simulation-estimate";
    load.ac = {
      voltageV: deliveredPowerW > 0 ? 220 : 0,
      currentA: round(acPowerW / 220, 2),
      powerW: round(acPowerW, 1),
    };
    load.dc = {
      voltageV: deliveredPowerW > 0 ? 5 : 0,
      currentA: round(dcPowerW / 5, 2),
      powerW: round(dcPowerW, 1),
    };

    solar.energyTodayWh = round(solar.energyTodayWh + solar.powerW * simulatedSeconds / 3600, 1);
    solar.controllerState = solar.powerW > 10 ? "generating" : "idle";
    return next;
  }
}
