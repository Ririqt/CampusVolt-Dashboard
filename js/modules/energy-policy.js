export function deriveEnergyPolicy(snapshot) {
  const { battery, system, weather } = snapshot;
  const poorForecast = weather.forecast === "low" || weather.forecast === "none";
  let policy;

  if (battery.soc < 25 || (poorForecast && battery.soc < 30)) {
    policy = {
      mode: "survival-eco-mode",
      maxLoadW: 60,
      reason: "Low reserve or weak forecast pauses AC outlets while reduced-power DC charging remains available.",
    };
  } else if (battery.soc < 50 && poorForecast) {
    policy = {
      mode: "conservation-mode",
      maxLoadW: 150,
      reason: "Battery SoC below 50% combined with a Low or None forecast requires restricted power allocation.",
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
