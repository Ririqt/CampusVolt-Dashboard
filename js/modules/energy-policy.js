export function deriveEnergyPolicy(snapshot) {
  const { battery, load, system, weather } = snapshot;
  const poorForecast = weather.forecast === "low" || weather.forecast === "none";
  let policy;

  if (battery.soc < 25 || weather.forecast === "none" || (poorForecast && battery.soc < 40)) {
    policy = {
      mode: "survival-eco-mode",
      maxLoadW: 60,
      reason: "Low reserve or weak forecast requires minimum-energy charging service.",
    };
  } else if ((battery.soc < 50 && poorForecast) || load.totalPowerW > 250) {
    policy = {
      mode: "conservation-mode",
      maxLoadW: 150,
      reason: "Low battery reserve combined with a weak forecast, or demand above 250 W, requires restricted power allocation.",
    };
  } else {
    policy = {
      mode: "normal-mode",
      maxLoadW: 456,
      reason: "No Conservation or Survival Eco trigger is active, so full service remains available.",
    };
  }

  policy.controller = "rule-based-demo";
  policy.safetyState = "normal";

  if (!system.bmsConnected) {
    policy.safetyState = "monitoring-unavailable";
    policy.maxLoadW = 0;
    policy.reason = "BMS telemetry is unavailable; the safety override pauses new sessions.";
  } else if (battery.protection !== "normal" || battery.temperatureC >= 55) {
    policy.safetyState = "protection-shutdown";
    policy.maxLoadW = 0;
    policy.reason = "Battery protection is active; the safety override pauses new sessions.";
  } else if (battery.soc < 10) {
    policy.mode = "survival-eco-mode";
    policy.safetyState = "battery-cutoff";
    policy.maxLoadW = 0;
    policy.reason = "Battery SoC is below the paper's 10% cutoff; all charging outputs are disabled.";
  }

  return policy;
}
