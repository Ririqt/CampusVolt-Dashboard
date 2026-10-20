import { kioskPreferences } from "./modules/kiosk-preferences.js?v=2";
import { telemetryStore } from "./modules/telemetry-store.js";
import { SIMULATION_SCENARIOS, TelemetrySimulator } from "./modules/telemetry-simulator.js";

const simulator = new TelemetrySimulator(telemetryStore);
const byId = (id) => document.getElementById(id);

const elements = {
  scenarioGrid: byId("scenario-grid"),
  scenarioDescription: byId("scenario-description"),
  solarInput: byId("solar-input"),
  solarOutput: byId("solar-output"),
  loadInput: byId("load-input"),
  loadOutput: byId("load-output"),
  forecast: byId("forecast-select"),
  speed: byId("speed-select"),
  status: byId("simulator-status"),
  statusDot: byId("simulator-status-dot"),
  policyMode: byId("policy-mode"),
  policyBadge: byId("policy-badge"),
  policyReason: byId("policy-reason"),
  policyWeather: byId("policy-weather"),
  policyExpected: byId("policy-expected"),
  policyController: byId("policy-controller"),
  policyLimit: byId("policy-limit"),
  policyAccess: byId("policy-access"),
  policySafety: byId("policy-safety"),
  policyLatency: byId("policy-latency"),
  soc: byId("metric-soc"),
  energy: byId("metric-energy"),
  batteryState: byId("metric-battery-state"),
  solar: byId("metric-solar"),
  solarState: byId("metric-solar-state"),
  load: byId("metric-load"),
  netPower: byId("metric-net-power"),
  temperature: byId("metric-temperature"),
  temperatureState: byId("metric-temperature-state"),
  estimate: byId("metric-estimate"),
  estimateLabel: byId("metric-estimate-label"),
  chart: byId("history-chart"),
  emptyHistory: byId("empty-history"),
  disabledNotice: byId("demo-disabled-notice"),
};

function applyDemoAvailability() {
  const enabled = kioskPreferences.isDemoModeEnabled();
  const layout = document.querySelector(".simulator-layout");
  if (layout) layout.dataset.disabled = String(!enabled);
  if (elements.disabledNotice) elements.disabledNotice.hidden = enabled;
  document.querySelectorAll(".simulator-layout button, .simulator-layout input, .simulator-layout select").forEach((control) => {
    control.disabled = !enabled;
  });
  if (!enabled) simulator.pause();
  render(telemetryStore.getSnapshot());
}

function titleCase(value) {
  return String(value || "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins} min`;
}

function renderScenarios(activeScenario) {
  elements.scenarioGrid.innerHTML = Object.entries(SIMULATION_SCENARIOS).map(([name, scenario]) => `
    <button class="scenario-button ${name === activeScenario ? "is-active" : ""}" type="button" data-scenario="${name}">
      <strong>${scenario.label}</strong>
      <span>${scenario.solarPowerW} W solar · ${scenario.loadPowerW} W load</span>
    </button>
  `).join("");
}

function renderChart() {
  const history = telemetryStore.getHistory().slice(-90);
  elements.emptyHistory.hidden = history.length > 1;
  elements.chart.hidden = history.length <= 1;
  if (history.length <= 1) return;

  const width = 800;
  const height = 190;
  const pad = 16;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const pointString = (key, max) => history.map((point, index) => {
    const x = pad + index / Math.max(history.length - 1, 1) * usableWidth;
    const y = height - pad - Math.min(Number(point[key]) || 0, max) / max * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  elements.chart.innerHTML = `
    <line class="grid" x1="16" y1="47.5" x2="784" y2="47.5"></line>
    <line class="grid" x1="16" y1="95" x2="784" y2="95"></line>
    <line class="grid" x1="16" y1="142.5" x2="784" y2="142.5"></line>
    <polyline class="line soc" points="${pointString("soc", 100)}"></polyline>
    <polyline class="line solar" points="${pointString("solarPowerW", 450)}"></polyline>
    <polyline class="line load" points="${pointString("loadPowerW", 400)}"></polyline>
  `;
}

function render(snapshot) {
  const { battery, solar, load, weather, system, energyManagement } = snapshot;
  const scenario = SIMULATION_SCENARIOS[snapshot.scenario];
  renderScenarios(snapshot.scenario);
  elements.scenarioDescription.textContent = scenario?.description || "Custom simulated station conditions.";

  elements.status.textContent = !kioskPreferences.isDemoModeEnabled()
    ? "Demonstration Mode disabled"
    : (system.running ? `Simulation running · ${system.speed}×` : "Simulation paused");
  elements.statusDot.classList.toggle("is-running", system.running);
  elements.speed.value = String(system.speed);
  elements.forecast.value = weather.forecast;

  if (document.activeElement !== elements.solarInput) elements.solarInput.value = Math.round(solar.powerW);
  if (document.activeElement !== elements.loadInput) elements.loadInput.value = Math.round(load.totalPowerW);
  elements.solarOutput.textContent = `${Math.round(solar.powerW)} W`;
  elements.loadOutput.textContent = `${Math.round(load.totalPowerW)} W`;

  elements.soc.textContent = battery.soc.toFixed(1);
  elements.energy.textContent = (battery.remainingEnergyWh / 1000).toFixed(2);
  elements.batteryState.textContent = titleCase(battery.status);
  elements.solar.textContent = Math.round(solar.powerW);
  elements.solarState.textContent = titleCase(solar.controllerState);
  elements.load.textContent = Math.round(load.totalPowerW);
  const powerDirection = battery.powerW >= 0 ? "to battery" : "from battery";
  elements.netPower.textContent = `${battery.powerW >= 0 ? "+" : ""}${Math.round(battery.powerW)} W ${powerDirection}`;
  elements.temperature.textContent = battery.temperatureC.toFixed(1);
  elements.temperatureState.textContent = battery.temperatureC >= 55 ? "Unsafe — protection active" : "Within operating range";

  const estimateMinutes = battery.status === "charging"
    ? battery.estimatedMinutesToFull
    : battery.estimatedRuntimeMinutes;
  elements.estimate.textContent = formatDuration(estimateMinutes);
  elements.estimateLabel.textContent = battery.status === "charging" ? "until full" : (battery.status === "discharging" ? "estimated runtime" : "stable load");

  elements.policyMode.textContent = titleCase(energyManagement.mode);
  elements.policyBadge.textContent = titleCase(energyManagement.mode);
  elements.policyReason.textContent = energyManagement.reason;
  elements.policyWeather.textContent = `${titleCase(weather.forecast)} · ${weather.expectedSolarW} W expected`;
  elements.policyExpected.textContent = `${titleCase(energyManagement.expectedMode || scenario?.expectedMode || energyManagement.mode)} · ${energyManagement.decisionMatchesExpected === false ? "Mismatch" : "Matched"}`;
  elements.policyController.textContent = energyManagement.controller === "rule-based-demo" ? "Rule-based demo baseline" : titleCase(energyManagement.controller);
  elements.policyLimit.textContent = `${energyManagement.maxLoadW} W`;
  elements.policyAccess.textContent = energyManagement.maxLoadW === 0
    ? "New sessions paused"
    : (energyManagement.mode === "normal-mode" ? "All permitted ports" : "Restricted by mode");
  elements.policySafety.textContent = titleCase(energyManagement.safetyState);
  elements.policyLatency.textContent = `${system.latencyMs} ms · ${system.messageId}`;
  const severity = energyManagement.maxLoadW === 0 ? "danger" : (energyManagement.mode !== "normal-mode" ? "warning" : "normal");
  elements.policyBadge.dataset.severity = severity;
  renderChart();
}

elements.scenarioGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scenario]");
  if (!button) return;
  simulator.applyScenario(button.dataset.scenario);
});

const updateManualInputs = () => simulator.setInputs({
  solarPowerW: Number(elements.solarInput.value),
  loadPowerW: Number(elements.loadInput.value),
});
elements.solarInput.addEventListener("input", updateManualInputs);
elements.loadInput.addEventListener("input", updateManualInputs);
elements.forecast.addEventListener("change", () => simulator.setWeatherForecast(elements.forecast.value));

byId("start-simulation").addEventListener("click", () => simulator.start(Number(elements.speed.value)));
byId("pause-simulation").addEventListener("click", () => simulator.pause());
byId("reset-simulation").addEventListener("click", () => simulator.reset());
elements.speed.addEventListener("change", () => {
  if (telemetryStore.getSnapshot().system.running) simulator.start(Number(elements.speed.value));
  else telemetryStore.update({ system: { speed: Number(elements.speed.value) } }, { recordHistory: false });
});

byId("clear-history").addEventListener("click", () => {
  telemetryStore.clearHistory();
  renderChart();
});

byId("export-history").addEventListener("click", () => {
  const history = telemetryStore.getHistory();
  if (!history.length) return;
  const isoOrBlank = (value) => {
    const date = new Date(Number(value));
    return Number.isFinite(date.getTime()) ? date.toISOString() : "";
  };
  const header = "timestamp,messageId,transmittedAt,receivedAt,latencyMs,scenario,weatherForecast,weatherRetrievedAt,soc,batteryPowerW,solarPowerW,loadDemandW,outputPowerW,acVoltageV,acCurrentA,dcVoltageV,dcCurrentA,temperatureC,selectedMode,expectedMode,decisionMatchesExpected,safetyState";
  const rows = history.map((point) => [
    isoOrBlank(point.timestamp), point.messageId || "",
    isoOrBlank(point.transmittedAt), isoOrBlank(point.receivedAt), point.latencyMs ?? "",
    point.scenario || "", point.weatherForecast || "", isoOrBlank(point.weatherRetrievedAt), point.soc, point.batteryPowerW,
    point.solarPowerW, point.loadPowerW, point.outputPowerW ?? "", point.acVoltageV ?? "", point.acCurrentA ?? "",
    point.dcVoltageV ?? "", point.dcCurrentA ?? "", point.temperatureC, point.mode || "", point.expectedMode || "",
    point.decisionMatchesExpected ?? "", point.safetyState || "",
  ].join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `campusvolt-telemetry-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

telemetryStore.addEventListener("telemetry-changed", (event) => render(event.detail.snapshot));
kioskPreferences.addEventListener("demo-mode-changed", applyDemoAvailability);

const initial = telemetryStore.getSnapshot();
simulator.setInputs({ solarPowerW: initial.solar.powerW, loadPowerW: initial.load.totalPowerW });
if (initial.system.running && kioskPreferences.isDemoModeEnabled()) simulator.start(initial.system.speed);
render(telemetryStore.getSnapshot());
applyDemoAvailability();
