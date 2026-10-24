/**
 * CampusVolt Dashboard - Charging Ports Controller (Mediator)
 * Low-coupling coordinator wiring State, Renderer, and Modal via Event Delegation.
 */

import { portsState } from "./ports-state.js?v=2";
import { PortsRenderer } from "./ports-renderer.js";
import { ChargingModal } from "./charging-modal.js";
import { telemetryStore } from "./telemetry-store.js?v=4";
import { kioskPreferences } from "./kiosk-preferences.js?v=3";

export class ChargingPortsController {
  constructor(containerId = "charging-ports-container") {
    this.containerId = containerId;
    this.container = null;
    this.renderer = null;
    this.modal = null;
    this.state = portsState;
    this.telemetry = telemetryStore;
  }

  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.warn(`ChargingPortsController: Container "#${this.containerId}" not found in DOM.`);
      return;
    }

    this.renderer = new PortsRenderer(this.container);
    this.modal = new ChargingModal(this.state);

    // Initial render
    this.renderer.render(this.state);
    this.renderer.updateDashboardCounters(this.state);

    // Bind event delegation on container
    this._bindDOMEvents();

    // Bind state events
    this._bindStateEvents();

    // Apply simulated or hardware-provided energy policy.
    this._applyEnergyPolicy(this.telemetry.getSnapshot());
    this.telemetry.addEventListener("telemetry-changed", (event) => {
      this._applyEnergyPolicy(event.detail.snapshot);
    });
    kioskPreferences.addEventListener("demo-mode-changed", () => {
      this._applyEnergyPolicy(this.telemetry.getSnapshot());
    });
  }

  _bindDOMEvents() {
    this.container.addEventListener("click", (e) => {
      const card = e.target.closest(".port-card");
      if (!card) return;

      const portId = card.dataset.portId;
      if (!portId) return;

      const port = this.state.getPort(portId);
      if (!port) return;

      if (port.status === "available" && !this._isPortAllowed(port, this.telemetry.getSnapshot())) {
        this._showEnergyToast(this.telemetry.getSnapshot().energyManagement.reason);
        return;
      }

      // Always open modal for the port (available -> payment selection, in-use -> active charging overlay)
      this.modal.openForPort(portId);
    });

    // Keyboard accessibility for card elements
    this.container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".port-card[role='button']");
        if (card) {
          e.preventDefault();
          card.click();
        }
      }
    });
  }

  _bindStateEvents() {
    // Port status changed (available <-> in-use)
    this.state.addEventListener("port-status-changed", (e) => {
      const { port } = e.detail;
      this.renderer.updatePortCard(port, this.state);
      this.renderer.updateDashboardCounters(this.state);
      this._applyEnergyPolicy(this.telemetry.getSnapshot());
    });

    // Session tick (per-second timer countdown)
    this.state.addEventListener("session-tick", (e) => {
      const { session } = e.detail;
      const port = this.state.getPort(session.portId);
      if (port) {
        this.renderer.updatePortCard(port, this.state);
      }
    });

    // Session finished
    this.state.addEventListener("session-completed", (e) => {
      const { port } = e.detail;
      this.renderer.updatePortCard(port, this.state);
      this.renderer.updateDashboardCounters(this.state);
      this._applyEnergyPolicy(this.telemetry.getSnapshot());
    });

    // Cross-tab or page sync event
    this.state.addEventListener("ports-synced", () => {
      this.renderer.render(this.state);
      this.renderer.updateDashboardCounters(this.state);
      this._applyEnergyPolicy(this.telemetry.getSnapshot());
    });
  }

  _isPortAllowed(port, snapshot) {
    if (!kioskPreferences.isDemoModeEnabled()) return true;
    const policy = snapshot.energyManagement;
    if (policy.maxLoadW <= 0) return false;
    if (policy.mode === "survival-eco-mode" && port.type === "outlet") return false;
    const ratedPowerByType = {
      outlet: 150,
      "type-c": 65,
      "micro-usb": 12,
      lightning: 20,
      wireless: 15,
    };
    const survivalDcAllowanceByType = {
      "type-c": 20,
      "micro-usb": 8,
      lightning: 12,
      wireless: 8,
    };
    const activeLoadW = Array.from(this.state.activeSessions.values())
      .reduce((total, session) => total + (Number(session.watts) || 0), 0);
    const requestedPowerW = policy.mode === "survival-eco-mode"
      ? (survivalDcAllowanceByType[port.type] || 20)
      : (ratedPowerByType[port.type] || 20);
    return activeLoadW + requestedPowerW <= policy.maxLoadW;
  }

  _applyEnergyPolicy(snapshot) {
    if (!this.container) return;
    for (const card of this.container.querySelectorAll(".port-card")) {
      const port = this.state.getPort(card.dataset.portId);
      if (!port) continue;
      const disabled = port.status === "available" && !this._isPortAllowed(port, snapshot);
      card.classList.toggle("port-card--energy-disabled", disabled);
      card.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (disabled) card.title = snapshot.energyManagement.reason;
      else card.removeAttribute("title");
    }
  }

  _showEnergyToast(message) {
    let toast = document.getElementById("port-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "port-toast";
      toast.className = "port-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("port-toast--visible");
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => toast.classList.remove("port-toast--visible"), 3200);
  }

  _showOccupiedToast(port) {
    let toast = document.getElementById("port-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "port-toast";
      toast.className = "port-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = `${port.name} is currently occupied by another device.`;
    toast.classList.add("port-toast--visible");

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove("port-toast--visible");
    }, 2800);
  }
}

/**
 * Convenience entry point to initialize charging ports
 */
export function initChargingPorts(containerId = "charging-ports-container") {
  const controller = new ChargingPortsController(containerId);
  controller.init();
  return controller;
}
