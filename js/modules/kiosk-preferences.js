/**
 * CampusVolt - Kiosk Global Preferences Module
 * Manages linear font scaling, language, screen brightness, and sound alerts.
 * Persists preferences across all pages via localStorage.
 */

import { i18n } from "./i18n.js";

class KioskPreferences {
  constructor() {
    this.fontScale = parseInt(localStorage.getItem("cv_font_scale") || "100", 10);
    this.brightness = localStorage.getItem("cv_brightness") || "auto";
    this.soundEnabled = localStorage.getItem("cv_sound") !== "false"; // default true
    this.lowBatteryAlert = localStorage.getItem("cv_low_battery") !== "false";
  }

  init() {
    this.applyFontScale(this.fontScale);
    this.applyBrightness(this.brightness);
    i18n.applyToDOM();
  }

  setFontScale(percent) {
    const val = Math.max(80, Math.min(140, parseInt(percent, 10)));
    this.fontScale = val;
    localStorage.setItem("cv_font_scale", val.toString());
    this.applyFontScale(val);
  }

  applyFontScale(percent) {
    const scale = (percent / 100);
    document.documentElement.style.setProperty("--cv-font-scale", scale.toString());
    document.documentElement.style.fontSize = `${14 * scale}px`;

    const applyBodyZoom = () => {
      if (document.body) {
        document.body.style.zoom = scale.toString();
        document.body.style.setProperty("--cv-font-scale", scale.toString());
      }
    };

    if (document.body) {
      applyBodyZoom();
    } else {
      document.addEventListener("DOMContentLoaded", applyBodyZoom, { once: true });
    }
  }

  setBrightness(mode) {
    this.brightness = mode;
    localStorage.setItem("cv_brightness", mode);
    this.applyBrightness(mode);
  }

  applyBrightness(mode) {
    const filter = mode === "60" ? "brightness(0.7)" : (mode === "100" ? "brightness(1.05)" : "none");
    document.documentElement.style.filter = filter;
  }

  setLanguage(lang) {
    i18n.setLanguage(lang);
  }

  getLanguage() {
    return i18n.getLanguage();
  }
}

export const kioskPreferences = new KioskPreferences();

// Auto-apply preferences immediately when DOM is loaded
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => kioskPreferences.init());
  } else {
    kioskPreferences.init();
  }
}
