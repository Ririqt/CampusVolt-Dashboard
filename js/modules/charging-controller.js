/**
 * CampusVolt Dashboard - Charging Ports Controller (Mediator)
 * Low-coupling coordinator wiring State, Renderer, and Modal via Event Delegation.
 */

import { portsState } from "./ports-state.js";
import { PortsRenderer } from "./ports-renderer.js";
import { ChargingModal } from "./charging-modal.js";

export class ChargingPortsController {
  constructor(containerId = "charging-ports-container") {
    this.containerId = containerId;
    this.container = null;
    this.renderer = null;
    this.modal = null;
    this.state = portsState;
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
  }

  _bindDOMEvents() {
    this.container.addEventListener("click", (e) => {
      const card = e.target.closest(".port-card");
      if (!card) return;

      const portId = card.dataset.portId;
      if (!portId) return;

      const port = this.state.getPort(portId);
      if (!port) return;

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
    });

    // Cross-tab or page sync event
    this.state.addEventListener("ports-synced", () => {
      this.renderer.render(this.state);
      this.renderer.updateDashboardCounters(this.state);
    });
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
