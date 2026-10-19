/**
 * CampusVolt Dashboard - Ports State Management
 * Modular architecture: State logic completely decoupled from UI presentation.
 * Manages port availability, active charging sessions, and countdown timers.
 */

import { PORT_CATEGORIES, PRICING_CONFIG } from "./ports-config.js";

class PortsStateManager extends EventTarget {
  constructor() {
    super();
    this.ports = new Map();
    this.activeSessions = new Map();
    this.devicesChargedCount = 37; // Baseline from dashboard
    this.totalEnergyDeliveredKWh = 3.2;

    this._initializePorts();
  }

  _initializePorts() {
    for (const category of PORT_CATEGORIES) {
      for (const port of category.ports) {
        this.ports.set(port.id, {
          ...port,
          status: port.initialStatus,
          categoryId: category.id,
          categoryTitle: category.title,
        });

        // Initialize active session for in-use ports to match Figma mockup
        if (port.initialStatus === "in-use") {
          const isPhone = port.type !== "outlet" && port.id !== "dc-type-c";
          const session = {
            portId: port.id,
            portName: port.name,
            portType: port.type,
            spec: port.spec,
            device: isPhone ? "Phone" : (port.id === "dc-type-c" ? "Laptop" : "Phone"),
            watts: isPhone ? 9 : 42,
            paid: port.id === "outlet-2" ? "₱15 · Cash" : "₱15 · GCash",
            durationMinutes: 15,
            totalSeconds: 900,
            remainingSeconds: port.id === "outlet-2" ? 900 : 720,
            cost: 15.0,
            startTime: Date.now(),
            energyKWh: 0.045,
            timerId: null,
          };
          this.activeSessions.set(port.id, session);
          this._startSessionTimer(session);
        }
      }
    }
  }

  _startSessionTimer(session) {
    if (session.timerId) clearInterval(session.timerId);
    session.timerId = setInterval(() => {
      session.remainingSeconds--;
      session.energyKWh += (session.watts / 3600000);

      this._dispatch("session-tick", { session });

      if (session.remainingSeconds <= 0) {
        this.completeSession(session.portId, true);
      }
    }, 1000);
  }

  /**
   * Get all registered ports as an array
   */
  getAllPorts() {
    return Array.from(this.ports.values());
  }

  /**
   * Get port by ID
   */
  getPort(portId) {
    return this.ports.get(portId) || null;
  }

  /**
   * Check if a port is currently available
   */
  isAvailable(portId) {
    const port = this.getPort(portId);
    return port ? port.status === "available" : false;
  }

  /**
   * Get active session for a port
   */
  getSession(portId) {
    return this.activeSessions.get(portId) || null;
  }

  /**
   * Get total count of active ports
   */
  getActiveCount() {
    let count = 0;
    for (const port of this.ports.values()) {
      if (port.status === "in-use") count++;
    }
    return count;
  }

  /**
   * Get total count of all ports
   */
  getTotalCount() {
    return this.ports.size;
  }

  /**
   * Calculate price for a given duration in minutes (₱1/min)
   */
  calculatePrice(minutes) {
    const rate = PRICING_CONFIG.ratePerMinute;
    return Number((minutes * rate).toFixed(2));
  }

  /**
   * Start a charging session on a port
   */
  startSession(portId, durationMinutes, method = "Cash", device = "Phone") {
    const port = this.getPort(portId);
    if (!port) {
      throw new Error(`Port "${portId}" not found.`);
    }

    port.status = "in-use";

    const totalSeconds = durationMinutes * 60;
    const session = {
      portId,
      portName: port.name,
      portType: port.type,
      spec: port.spec,
      device: device || (port.type === "outlet" ? "Phone" : "Phone"),
      watts: port.type === "outlet" ? 9 : (port.type === "wireless" ? 10 : 9),
      paid: `₱${durationMinutes} · ${method}`,
      durationMinutes,
      totalSeconds,
      remainingSeconds: totalSeconds,
      cost: this.calculatePrice(durationMinutes),
      startTime: Date.now(),
      energyKWh: 0.0,
      timerId: null,
    };

    this.activeSessions.set(portId, session);
    this._dispatch("port-status-changed", { port, session });
    this._startSessionTimer(session);

    return session;
  }

  /**
   * Complete or stop a charging session
   */
  completeSession(portId, naturalFinish = false) {
    const session = this.activeSessions.get(portId);
    if (session) {
      clearInterval(session.timerId);
      this.activeSessions.delete(portId);
    }

    const port = this.getPort(portId);
    if (port) {
      port.status = "available";
      this.devicesChargedCount++;
      if (session) {
        this.totalEnergyDeliveredKWh += session.energyKWh;
      }
      this._dispatch("port-status-changed", { port, session: null });
      this._dispatch("session-completed", { port, session, naturalFinish });
    }
  }

  /**
   * Internal event dispatcher wrapper
   */
  _dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

// Singleton state instance
export const portsState = new PortsStateManager();
