const RAPID_DISCHARGE_LOAD_W = 250;
const RAPID_DISCHARGE_SOC_PERCENT = 60;
const RAPID_DISCHARGE_SOLAR_MARGIN_W = 30;
const RAPID_DISCHARGE_RELEASE_SOC_PERCENT = 65;

export function deriveEnergyPolicy(snapshot) {
  const { battery, load, solar, system, weather } = snapshot;
  const poorForecast = weather.forecast === "low" || weather.forecast === "none";
  const previousPolicy = snapshot.energyManagement || {};
  const requestedLoadW = Math.max(
    0,
    Number(load.demandPowerW) || 0,
    Number(load.totalPowerW) || 0
  );
  const solarPowerW = Math.max(0, Number(solar.powerW) || 0);
  const rapidDischargeEvent = requestedLoadW > RAPID_DISCHARGE_LOAD_W
    && battery.soc < RAPID_DISCHARGE_SOC_PERCENT
    && solarPowerW < requestedLoadW + RAPID_DISCHARGE_SOLAR_MARGIN_W;
  const solarRecoveryComplete = battery.soc >= RAPID_DISCHARGE_RELEASE_SOC_PERCENT
    && battery.powerW > 5
    && solarPowerW >= requestedLoadW;
  let rapidDischargeLatched = Boolean(previousPolicy.rapidDischargeLatched);
  let rapidDischargeTriggeredAt = previousPolicy.rapidDischargeTriggeredAt || null;

  if (rapidDischargeEvent) {
    rapidDischargeLatched = true;
    rapidDischargeTriggeredAt ||= Number(system.updatedAt) || Date.now();
  } else if (rapidDischargeLatched && solarRecoveryComplete) {
    rapidDischargeLatched = false;
    rapidDischargeTriggeredAt = null;
  }

  let policy;

  if (battery.soc < 25 || (poorForecast && battery.soc < 30)) {
    policy = {
      mode: "survival-eco-mode",
      maxLoadW: 60,
      reason: "Low reserve or weak forecast pauses AC outlets while reduced-power DC charging remains available.",
    };
  } else if (rapidDischargeLatched) {
    policy = {
      mode: "conservation-mode",
      maxLoadW: 150,
      reason: "Rapid discharge protection is latched until solar charging replenishes the battery to 65% SoC.",
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
  policy.rapidDischargeLatched = rapidDischargeLatched;
  policy.rapidDischargeTriggeredAt = rapidDischargeTriggeredAt;

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
