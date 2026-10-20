// CampusVolt Station Telemetry Controller (Information Page)
import { portsState } from "./modules/ports-state.js";
import { telemetryStore } from "./modules/telemetry-store.js?v=3";
import { kioskPreferences } from "./modules/kiosk-preferences.js?v=2";

const text = (id, value) => {
  const element = document.getElementById(id);
  if (element && value !== undefined && value !== null) element.textContent = String(value);
};

const titleCase = (value) => String(value || "")
  .replace(/-/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

function renderEnergy(kilowattHours, valueId, unitId) {
  if (kilowattHours < 1) {
    text(valueId, (kilowattHours * 1000).toFixed(2));
    text(unitId, "Wh");
  } else {
    text(valueId, kilowattHours.toFixed(3));
    text(unitId, "kWh");
  }
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins} min`;
}

function formatTelemetryAge(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - Number(timestamp)) / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function renderStationTelemetry(snapshot) {
  const { battery, solar, weather, system, energyManagement } = snapshot;
  const ring = document.getElementById("battery-ring");
  const sourceBadge = document.getElementById("telemetry-source-badge");
  const notice = document.getElementById("telemetry-notice");

  text("battery-percent-value", Math.round(battery.soc));
  if (ring) ring.style.setProperty("--progress", Math.max(0, Math.min(100, battery.soc)));
  text("battery-status-value", titleCase(battery.status));
  text("battery-detail-soc-value", Math.round(battery.soc));
  text("battery-detail-status-value", titleCase(battery.status));
  text("battery-est-full-value", battery.status === "charging" ? formatMinutes(battery.estimatedMinutesToFull) : "—");
  text("battery-runtime-value", battery.status === "discharging" ? formatMinutes(battery.estimatedRuntimeMinutes) : "—");
  text("battery-capacity-kwh-value", (battery.ratedEnergyWh / 1000).toFixed(2));
  text("battery-pack-voltage-value", battery.voltage.toFixed(2));
  text("battery-current-value", `${battery.currentA >= 0 ? "+" : ""}${battery.currentA.toFixed(2)}`);
  text("battery-power-value", `${battery.powerW >= 0 ? "+" : ""}${Math.round(battery.powerW)}`);
  text("battery-remaining-kwh-value", (battery.remainingEnergyWh / 1000).toFixed(2));
  text("battery-temperature-value", battery.temperatureC.toFixed(1));
  text("battery-health-value", battery.healthPercent.toFixed(0));
  text("battery-cell-delta-value", battery.cellDeltaMv.toFixed(0));
  text("battery-protection-value", titleCase(battery.protection));
  text("battery-updated-value", formatTelemetryAge(system.updatedAt));

  text("solar-power-value", Math.round(solar.powerW));
  text("solar-today-value", (solar.energyTodayWh / 1000).toFixed(2));
  text("solar-peak-value", Math.round(solar.peakPowerW));
  text("solar-state-value", titleCase(solar.controllerState));
  text("solar-telemetry-source", snapshot.source === "simulation" ? "Simulation model" : titleCase(snapshot.source));

  text("telemetry-policy-mode", titleCase(energyManagement.mode));
  text("telemetry-policy-reason", energyManagement.reason);
  if (sourceBadge) sourceBadge.textContent = snapshot.source === "simulation" ? "Simulation" : titleCase(snapshot.source);
  if (notice) {
    notice.dataset.severity = energyManagement.maxLoadW === 0
      ? "danger"
      : (energyManagement.mode === "normal-mode" ? "normal" : "warning");
  }

  const statusName = document.getElementById("connection-name");
  const statusDot = document.getElementById("connection-dot");
  if (statusName) statusName.textContent = kioskPreferences.isDemoModeEnabled()
    ? (system.bmsConnected ? "Demo telemetry" : "BMS disconnected")
    : "Local interface";
  if (statusDot) statusDot.classList.toggle("live-pill__dot--offline", !system.bmsConnected);
}

// 1. Sync live ports state with Information page overview strip
const updatePortsTelemetry = () => {
  const activeEl = document.getElementById("ports-active-value");
  const totalEl = document.getElementById("ports-total-value");
  if (activeEl) activeEl.textContent = portsState.getActiveCount().toString();
  if (totalEl) totalEl.textContent = portsState.getTotalCount().toString();
  text("output-active-channels-value", `${portsState.getActiveCount()} of ${portsState.getTotalCount()}`);

  const dailyStats = portsState.getDailyStats();
  const output = portsState.getLiveOutputTelemetry();
  text("devices-charged-value", dailyStats.devicesConnected);
  text("output-total-power-value", output.totalPowerW.toFixed(1));
  text("output-demand-power-value", output.demandPowerW.toFixed(1));
  text("output-ac-voltage-value", output.ac.voltageV.toFixed(1));
  text("output-ac-current-value", output.ac.currentA.toFixed(2));
  text("output-ac-power-value", output.ac.powerW.toFixed(1));
  text("output-dc-voltage-value", output.dc.voltageV.toFixed(2));
  text("output-dc-current-value", output.dc.currentA.toFixed(2));
  text("output-dc-power-value", output.dc.powerW.toFixed(1));
  const demoModeEnabled = kioskPreferences.isDemoModeEnabled();
  text("output-telemetry-source", demoModeEnabled ? "Live session simulation" : "Charging output monitor");
  text(
    "output-telemetry-note",
    demoModeEnabled
      ? "Values respond to the ports currently in use and each session's power draw. Gentle load variation is simulated; the hardware build will replace it with PZEM-004T and DC sensor readings."
      : "Output readings remain available in the standard interface. PZEM-004T and DC sensor readings will replace the current session-based values when the ESP32 hardware is connected."
  );
  renderEnergy(dailyStats.energyDeliveredKWh, "energy-delivered-value", "energy-delivered-unit");
  renderEnergy(dailyStats.energyDeliveredKWh, "output-energy-value", "output-energy-unit");
};

updatePortsTelemetry();
portsState.addEventListener("port-status-changed", updatePortsTelemetry);
portsState.addEventListener("session-tick", updatePortsTelemetry);
portsState.addEventListener("session-completed", updatePortsTelemetry);
portsState.addEventListener("ports-synced", updatePortsTelemetry);
portsState.addEventListener("daily-stats-changed", updatePortsTelemetry);

renderStationTelemetry(telemetryStore.getSnapshot());
telemetryStore.addEventListener("telemetry-changed", (event) => renderStationTelemetry(event.detail.snapshot));
kioskPreferences.addEventListener("demo-mode-changed", () => {
  renderStationTelemetry(telemetryStore.getSnapshot());
  updatePortsTelemetry();
});
window.setInterval(() => {
  const current = telemetryStore.getSnapshot();
  text("battery-updated-value", formatTelemetryAge(current.system.updatedAt));
  updatePortsTelemetry();
}, 5000);

// Live weather forecast for the fixed CampusVolt kiosk location.
const WEATHER_API_URL = new URL("https://api.open-meteo.com/v1/forecast");
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const WEATHER_CACHE_KEY = "campusvolt-weather-v1";

WEATHER_API_URL.search = new URLSearchParams({
  latitude: "14.599060",
  longitude: "121.005898",
  current: "temperature_2m,weather_code,cloud_cover,precipitation_probability,shortwave_radiation,is_day",
  hourly: "shortwave_radiation,precipitation_probability,is_day",
  forecast_hours: "6",
  timezone: "Asia/Manila",
}).toString();

const weatherElements = {
  temperature: document.getElementById("weather-temp-value"),
  condition: document.getElementById("weather-condition"),
  location: document.getElementById("weather-location"),
  solarOutlook: document.getElementById("weather-expected-solar"),
  source: document.getElementById("weather-source"),
  cloudCover: document.getElementById("weather-cloud-cover"),
  rainProbability: document.getElementById("weather-rain-probability"),
  solarRadiation: document.getElementById("weather-solar-radiation"),
  status: document.getElementById("weather-sensor-status"),
  updated: document.getElementById("weather-telemetry-source"),
};

const weatherCodeLabels = new Map([
  [0, "Clear sky"],
  [1, "Mainly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Foggy"],
  [48, "Rime fog"],
  [51, "Light drizzle"],
  [53, "Drizzle"],
  [55, "Heavy drizzle"],
  [56, "Freezing drizzle"],
  [57, "Heavy freezing drizzle"],
  [61, "Light rain"],
  [63, "Rain"],
  [65, "Heavy rain"],
  [66, "Freezing rain"],
  [67, "Heavy freezing rain"],
  [71, "Light snow"],
  [73, "Snow"],
  [75, "Heavy snow"],
  [77, "Snow grains"],
  [80, "Light rain showers"],
  [81, "Rain showers"],
  [82, "Heavy rain showers"],
  [85, "Snow showers"],
  [86, "Heavy snow showers"],
  [95, "Thunderstorm"],
  [96, "Thunderstorm with hail"],
  [99, "Severe thunderstorm with hail"],
]);

function setWeatherText(element, value) {
  if (element && value !== undefined && value !== null) {
    element.textContent = String(value);
  }
}

function average(values) {
  const validValues = values.filter(Number.isFinite);
  if (!validValues.length) return 0;
  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function getSolarOutlook(radiationValues, isDay) {
  if (!isDay && radiationValues.every((value) => !Number.isFinite(value) || value < 25)) return "None (night)";

  const expectedRadiation = average(radiationValues);
  if (expectedRadiation >= 500) return "High";
  if (expectedRadiation >= 250) return "Moderate";
  if (expectedRadiation >= 25) return "Low";
  return "Very low";
}

function normalizeWeather(data) {
  if (!data?.current || !Number.isFinite(data.current.temperature_2m)) {
    throw new Error("Weather API returned incomplete current conditions.");
  }

  const hourlyRadiation = Array.isArray(data.hourly?.shortwave_radiation)
    ? data.hourly.shortwave_radiation.slice(0, 3).map(Number)
    : [];
  const hourlyRain = Array.isArray(data.hourly?.precipitation_probability)
    ? data.hourly.precipitation_probability.slice(0, 3).map(Number)
    : [];
  const currentRadiation = Number(data.current.shortwave_radiation);
  const currentRain = Number(data.current.precipitation_probability);

  return {
    temperature: Math.round(Number(data.current.temperature_2m)),
    condition: weatherCodeLabels.get(Number(data.current.weather_code)) ?? "Current conditions",
    cloudCover: Math.round(Number(data.current.cloud_cover) || 0),
    rainProbability: Math.round(Number.isFinite(currentRain) ? currentRain : average(hourlyRain)),
    solarRadiation: Math.round(Number.isFinite(currentRadiation) ? currentRadiation : average(hourlyRadiation)),
    solarOutlook: getSolarOutlook(hourlyRadiation, Boolean(data.current.is_day)),
    fetchedAt: Date.now(),
  };
}

function formatUpdateTime(timestamp) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(timestamp));
}

function renderWeather(weather, { cached = false } = {}) {
  setWeatherText(weatherElements.temperature, weather.temperature);
  setWeatherText(weatherElements.condition, weather.condition);
  setWeatherText(weatherElements.location, "PUP CEA, Manila");
  setWeatherText(weatherElements.solarOutlook, weather.solarOutlook);
  setWeatherText(weatherElements.source, "Open-Meteo");
  setWeatherText(weatherElements.cloudCover, `${weather.cloudCover}%`);
  setWeatherText(weatherElements.rainProbability, `${weather.rainProbability}%`);
  setWeatherText(weatherElements.solarRadiation, `${weather.solarRadiation} W/m²`);
  setWeatherText(weatherElements.status, cached ? "Cached forecast" : "Live forecast");
  setWeatherText(weatherElements.updated, `${cached ? "Cached" : "Updated"} ${formatUpdateTime(weather.fetchedAt)}`);
}

function readCachedWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
    return cached && Number.isFinite(cached.fetchedAt) ? cached : null;
  } catch {
    return null;
  }
}

async function updateWeather() {
  if (!weatherElements.temperature) return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(WEATHER_API_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Weather request failed with status ${response.status}.`);

    const weather = normalizeWeather(await response.json());
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weather));
    renderWeather(weather);
  } catch (error) {
    const cachedWeather = readCachedWeather();
    if (cachedWeather) {
      renderWeather(cachedWeather, { cached: true });
    } else {
      setWeatherText(weatherElements.condition, "Forecast unavailable");
      setWeatherText(weatherElements.status, "Connection failed");
      setWeatherText(weatherElements.updated, "Waiting to retry");
    }
    console.warn("CampusVolt weather update failed:", error);
  } finally {
    window.clearTimeout(timeout);
  }
}

const cachedWeather = readCachedWeather();
if (cachedWeather) renderWeather(cachedWeather, { cached: true });
updateWeather();
window.setInterval(updateWeather, WEATHER_REFRESH_MS);
