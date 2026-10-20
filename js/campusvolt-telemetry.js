// CampusVolt Station Telemetry Controller (Information Page)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { portsState } from "./modules/ports-state.js";

// 1. Sync live ports state with Information page overview strip
const updatePortsTelemetry = () => {
  const activeEl = document.getElementById("ports-active-value");
  const totalEl = document.getElementById("ports-total-value");
  if (activeEl) activeEl.textContent = portsState.getActiveCount().toString();
  if (totalEl) totalEl.textContent = portsState.getTotalCount().toString();
};

updatePortsTelemetry();
portsState.addEventListener("port-status-changed", updatePortsTelemetry);
portsState.addEventListener("session-completed", updatePortsTelemetry);
portsState.addEventListener("ports-synced", updatePortsTelemetry);

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDTVOxATLW_ScNwUFTf9No6EhMz_m2P2OY",
  authDomain: "campusvolt.firebaseapp.com",
  projectId: "campusvolt",
  storageBucket: "campusvolt.firebasestorage.app",
  messagingSenderId: "398807888",
  appId: "1:398807888:web:e04775c07d2486f60c5255"
};

const solarPowerEl = document.getElementById("solar-power-value");

// Keep unfinished Firebase telemetry from blocking the independent weather feed.
try {
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const solarPowerRef = ref(database, "CampusVolt/station01/solarPower");

  if (solarPowerEl) {
    onValue(solarPowerRef, (snapshot) => {
      const data = snapshot.val();
      if (data !== null) {
        solarPowerEl.textContent = data;
        console.log(`New solar power value received: ${data}`);
      } else {
        console.log("No data found at this path.");
      }
    });
  }
} catch (error) {
  console.warn("CampusVolt Firebase telemetry is not configured yet:", error);
}

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

