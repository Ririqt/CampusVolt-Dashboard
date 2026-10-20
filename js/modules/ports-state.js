/**
 * CampusVolt Dashboard - Ports State Management
 * Modular architecture: State logic completely decoupled from UI presentation.
 * Manages port availability, active charging sessions, countdown timers,
 * and robust cross-tab / cross-navigation state persistence via localStorage.
 */

import { PORT_CATEGORIES, PRICING_CONFIG } from "./ports-config.js";

const STORAGE_KEY_SESSIONS = "cv_charging_sessions";
const STORAGE_KEY_PORTS = "cv_ports_status";
const STORAGE_KEY_STATS = "cv_charging_stats";

class PortsStateManager extends EventTarget {
  constructor() {
    super();
    this.ports = new Map();
    this.activeSessions = new Map();
    this.devicesChargedCount = 37; // Baseline from dashboard
    this.totalEnergyDeliveredKWh = 3.2;
    this.channel = null;

    this._initializePorts();
    this._setupGlobalListeners();
  }

  _initializePorts() {
    // 1. Populate all ports from configuration
    for (const category of PORT_CATEGORIES) {
      for (const port of category.ports) {
        this.ports.set(port.id, {
          ...port,
          status: port.initialStatus,
          categoryId: category.id,
          categoryTitle: category.title,
        });
      }
    }

    // 2. Load saved stats if any
    const savedStats = this._loadSavedStats();
    if (savedStats) {
      if (typeof savedStats.devicesChargedCount === "number") {
        this.devicesChargedCount = savedStats.devicesChargedCount;
      }
      if (typeof savedStats.totalEnergyDeliveredKWh === "number") {
        this.totalEnergyDeliveredKWh = savedStats.totalEnergyDeliveredKWh;
      }
    }

    // 3. Load saved sessions if any
    const savedSessions = this._loadSavedSessions();
    const now = Date.now();

    if (savedSessions && savedSessions.length > 0) {
      for (const sessionData of savedSessions) {
        const port = this.ports.get(sessionData.portId);
        if (!port) continue;

        // Calculate actual remaining seconds using wall-clock timestamp
        const remainingSeconds = Math.max(0, Math.round((sessionData.endTime - now) / 1000));

        if (remainingSeconds > 0) {
          port.status = "in-use";
          const session = {
            ...sessionData,
            remainingSeconds,
            timerId: null,
          };
          this.activeSessions.set(session.portId, session);
          this._startSessionTimer(session);
        } else {
          // Finished while away on other section or tab
          port.status = "available";
          this.devicesChargedCount++;
          if (sessionData.energyKWh) {
            this.totalEnergyDeliveredKWh += sessionData.energyKWh;
          }
        }
      }

      // Also restore any port overrides
      const savedPorts = this._loadSavedPortStatuses();
      if (savedPorts) {
        for (const [portId, status] of Object.entries(savedPorts)) {
          const port = this.ports.get(portId);
          if (port && !this.activeSessions.has(portId)) {
            port.status = status;
          }
        }
      }

      this._saveToStorage(false);
    } else if (savedSessions === null) {
      // First run in this browser: Initialize default active sessions if defined in PORT_CATEGORIES
      for (const category of PORT_CATEGORIES) {
        for (const port of category.ports) {
          if (port.initialStatus === "in-use") {
            const isPhone = port.type !== "outlet" && port.id !== "dc-type-c";
            const totalSeconds = 900;
            const remainingSeconds = port.id === "outlet-2" ? 900 : 720;
            const session = {
              portId: port.id,
              portName: port.name,
              portType: port.type,
              spec: port.spec,
              device: isPhone ? "Phone" : (port.id === "dc-type-c" ? "Laptop" : "Phone"),
              watts: isPhone ? 9 : 42,
              paid: port.id === "outlet-2" ? "₱15 · Cash" : "₱15 · GCash",
              durationMinutes: 15,
              totalSeconds,
              remainingSeconds,
              cost: 15.0,
              startTime: now - (totalSeconds - remainingSeconds) * 1000,
              endTime: now + remainingSeconds * 1000,
              energyKWh: 0.045,
              timerId: null,
            };
            this.activeSessions.set(port.id, session);
            this._startSessionTimer(session);
          }
        }
      }
      this._saveToStorage(false);
    }
  }

  _setupGlobalListeners() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // 1. When switching browser tabs (visibility change)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this._recheckAllSessions();
      }
    });

    // 2. When navigating between pages or returning via browser back/forward (pageshow)
    window.addEventListener("pageshow", () => {
      this._recheckAllSessions();
    });

    // 3. Cross-tab real-time synchronization via storage event
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY_SESSIONS || e.key === STORAGE_KEY_PORTS) {
        this._syncFromExternalStorage();
      }
    });

    // 4. Instant cross-tab BroadcastChannel
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel("campusvolt_ports_channel");
        this.channel.onmessage = (event) => {
          if (event?.data?.type === "sessions-updated") {
            this._syncFromExternalStorage();
          }
        };
      } catch (err) {
        // BroadcastChannel unavailable
      }
    }
  }

  _startSessionTimer(session) {
    if (session.timerId) clearInterval(session.timerId);

    session.timerId = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.round((session.endTime - now) / 1000));
      session.remainingSeconds = remaining;
      session.energyKWh += (session.watts / 3600000);

      // Fast storage save for remaining seconds without spamming broadcast
      this._saveSessionsOnly();

      this._dispatch("session-tick", { session });

      if (remaining <= 0) {
        this.completeSession(session.portId, true);
      }
    }, 1000);
  }

  /**
   * Recalculate remaining seconds against wall-clock Date.now()
   */
  _recheckAllSessions() {
    const now = Date.now();
    let changed = false;

    for (const [portId, session] of this.activeSessions.entries()) {
      const remaining = Math.max(0, Math.round((session.endTime - now) / 1000));
      session.remainingSeconds = remaining;

      if (remaining <= 0) {
        this.completeSession(portId, true);
        changed = true;
      } else {
        this._dispatch("session-tick", { session });
      }
    }

    if (changed) {
      this._saveToStorage();
    }
  }

  /**
   * Sync active state if another tab or window made changes
   */
  _syncFromExternalStorage() {
    const savedSessions = this._loadSavedSessions() || [];
    const now = Date.now();
    const newSessionPortIds = new Set(savedSessions.map(s => s.portId));

    // Stop and remove sessions that were completed in other tab
    for (const [portId, session] of this.activeSessions.entries()) {
      if (!newSessionPortIds.has(portId)) {
        clearInterval(session.timerId);
        this.activeSessions.delete(portId);
        const port = this.getPort(portId);
        if (port) {
          port.status = "available";
          this._dispatch("port-status-changed", { port, session: null });
        }
      }
    }

    // Add or update sessions from other tab
    for (const sessionData of savedSessions) {
      const remaining = Math.max(0, Math.round((sessionData.endTime - now) / 1000));
      const port = this.getPort(sessionData.portId);
      if (!port) continue;

      if (remaining > 0) {
        port.status = "in-use";
        let session = this.activeSessions.get(sessionData.portId);
        if (!session) {
          session = {
            ...sessionData,
            remainingSeconds: remaining,
            timerId: null,
          };
          this.activeSessions.set(session.portId, session);
          this._startSessionTimer(session);
        } else {
          session.remainingSeconds = remaining;
          session.energyKWh = sessionData.energyKWh || session.energyKWh;
        }
        this._dispatch("port-status-changed", { port, session });
      } else {
        port.status = "available";
      }
    }

    this._dispatch("ports-synced", {});
  }

  /**
   * Storage Helpers
   */
  _saveToStorage(broadcast = true) {
    if (typeof localStorage === "undefined") return;

    try {
      // 1. Sessions
      const sessionsArr = Array.from(this.activeSessions.values()).map(s => ({
        portId: s.portId,
        portName: s.portName,
        portType: s.portType,
        spec: s.spec,
        device: s.device,
        watts: s.watts,
        paid: s.paid,
        durationMinutes: s.durationMinutes,
        totalSeconds: s.totalSeconds,
        remainingSeconds: s.remainingSeconds,
        cost: s.cost,
        startTime: s.startTime,
        endTime: s.endTime,
        energyKWh: s.energyKWh,
      }));
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsArr));

      // 2. Ports status
      const portsObj = {};
      for (const [id, port] of this.ports.entries()) {
        portsObj[id] = port.status;
      }
      localStorage.setItem(STORAGE_KEY_PORTS, JSON.stringify(portsObj));

      // 3. Stats
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify({
        devicesChargedCount: this.devicesChargedCount,
        totalEnergyDeliveredKWh: this.totalEnergyDeliveredKWh,
      }));

      // Broadcast to other tabs
      if (broadcast && this.channel) {
        this.channel.postMessage({ type: "sessions-updated", timestamp: Date.now() });
      }
    } catch (e) {
      console.warn("CampusVolt: Failed to save ports state to localStorage", e);
    }
  }

  _saveSessionsOnly() {
    if (typeof localStorage === "undefined") return;
    try {
      const sessionsArr = Array.from(this.activeSessions.values()).map(s => ({
        portId: s.portId,
        portName: s.portName,
        portType: s.portType,
        spec: s.spec,
        device: s.device,
        watts: s.watts,
        paid: s.paid,
        durationMinutes: s.durationMinutes,
        totalSeconds: s.totalSeconds,
        remainingSeconds: s.remainingSeconds,
        cost: s.cost,
        startTime: s.startTime,
        endTime: s.endTime,
        energyKWh: s.energyKWh,
      }));
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsArr));
    } catch (e) {}
  }

  _loadSavedSessions() {
    if (typeof localStorage === "undefined") return null;
    try {
      const item = localStorage.getItem(STORAGE_KEY_SESSIONS);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }

  _loadSavedPortStatuses() {
    if (typeof localStorage === "undefined") return null;
    try {
      const item = localStorage.getItem(STORAGE_KEY_PORTS);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }

  _loadSavedStats() {
    if (typeof localStorage === "undefined") return null;
    try {
      const item = localStorage.getItem(STORAGE_KEY_STATS);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
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

    const now = Date.now();
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
      startTime: now,
      endTime: now + totalSeconds * 1000,
      energyKWh: 0.0,
      timerId: null,
    };

    this.activeSessions.set(portId, session);
    this._saveToStorage();
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
      this._saveToStorage();
      this._dispatch("port-status-changed", { port, session: null });
      this._dispatch("session-completed", { port, session, naturalFinish });
    }
  }

  /**
   * Reset all ports and sessions to default available (utility for testing/demo reset)
   */
  resetAllPorts() {
    for (const session of this.activeSessions.values()) {
      if (session.timerId) clearInterval(session.timerId);
    }
    this.activeSessions.clear();

    for (const port of this.ports.values()) {
      port.status = "available";
    }

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      localStorage.removeItem(STORAGE_KEY_PORTS);
    }

    this._saveToStorage();
    this._dispatch("ports-synced", {});
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
