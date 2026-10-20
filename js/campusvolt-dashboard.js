// CampusVolt Dashboard Main Controller
import { initChargingPorts } from "./modules/charging-controller.js?v=4";
import { kioskPreferences } from "./modules/kiosk-preferences.js?v=2";
import { telemetryStore } from "./modules/telemetry-store.js?v=4";

// -------------------------------------------------------------
// 1. Initialize Modular Charging Ports Component (Figma Design)
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initChargingPorts("charging-ports-container");
});

function titleCase(value) {
  return String(value || "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderStationStatus(snapshot) {
  const { battery, solar, load, weather, system, energyManagement } = snapshot;
  const strip = document.getElementById("station-telemetry-strip");
  const source = document.getElementById("dashboard-telemetry-source");
  const policyMode = document.getElementById("dashboard-policy-mode");
  const policyReason = document.getElementById("dashboard-policy-reason");
  const connectionName = document.getElementById("connection-name");
  const connectionDot = document.getElementById("connection-dot");

  if (source) source.textContent = snapshot.source === "simulation" ? "Simulation" : titleCase(snapshot.source);
  if (policyMode) policyMode.textContent = titleCase(energyManagement.mode);
  if (policyReason) policyReason.textContent = energyManagement.reason;
  if (strip) strip.dataset.severity = energyManagement.maxLoadW === 0
    ? "danger"
    : (energyManagement.mode === "normal-mode" ? "normal" : "warning");

  const soc = document.getElementById("dashboard-battery-soc");
  const solarPower = document.getElementById("dashboard-solar-power");
  const loadPower = document.getElementById("dashboard-load-power");
  const forecast = document.getElementById("dashboard-weather-forecast");
  const latency = document.getElementById("dashboard-telemetry-latency");
  if (soc) soc.textContent = battery.soc.toFixed(1);
  if (solarPower) solarPower.textContent = Math.round(solar.powerW);
  if (loadPower) loadPower.textContent = Math.round(load.totalPowerW);
  if (forecast) forecast.textContent = titleCase(weather.forecast);
  if (latency) latency.textContent = system.latencyMs;
  if (source) source.title = `${system.messageId} · updated ${new Date(system.updatedAt).toLocaleTimeString()}`;
  if (connectionName) connectionName.textContent = kioskPreferences.isDemoModeEnabled()
    ? (system.bmsConnected ? "Demo telemetry" : "BMS disconnected")
    : "Local interface";
  if (connectionDot) connectionDot.classList.toggle("live-pill__dot--offline", !system.bmsConnected);
}

renderStationStatus(telemetryStore.getSnapshot());
telemetryStore.addEventListener("telemetry-changed", (event) => renderStationStatus(event.detail.snapshot));
kioskPreferences.addEventListener("demo-mode-changed", () => renderStationStatus(telemetryStore.getSnapshot()));
