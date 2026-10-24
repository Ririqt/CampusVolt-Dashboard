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
const SHARED_SESSIONS_URL = "/api/sessions";
const SHARED_SYNC_INTERVAL_MS = 3000;

function getLocalDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getLocalDayBounds(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(year, month - 1, day).getTime();
  return { start, end: new Date(year, month - 1, day + 1).getTime() };
}

class PortsStateManager extends EventTarget {
  constructor() {
    super();
    this.ports = new Map();
    this.activeSessions = new Map();
    this.statsDateKey = getLocalDateKey();
    this.devicesChargedCount = 0;
    this.totalEnergyDeliveredKWh = 0;
    this.channel = null;
    this.sharedSyncAvailable = null;
    this.sharedSyncTimer = null;

    this._initializePorts();
    this._setupGlobalListeners();
    this._setupSharedSync();
  }

  _setupSharedSync() {
    if (typeof window === "undefined" || typeof fetch === "undefined") return;
    this._syncFromServer();
    this.sharedSyncTimer = setInterval(() => this._syncFromServer(), SHARED_SYNC_INTERVAL_MS);
  }

  async _syncFromServer() {
    try {
      const response = await fetch(SHARED_SESSIONS_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Shared sync returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.sessions)) throw new Error("Invalid shared session data");
      this.sharedSyncAvailable = true;
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(payload.sessions));
      this._syncFromExternalStorage();
    } catch (error) {
      this.sharedSyncAvailable = false;
    }
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
    const hasCurrentDayStats = savedStats?.dateKey === this.statsDateKey;
    if (hasCurrentDayStats) {
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
          if (!hasCurrentDayStats && getLocalDateKey(session.startTime) === this.statsDateKey) {
            this.devicesChargedCount++;
          }
          this._startSessionTimer(session);
        } else {
          // Finished while away on other section or tab
          port.status = "available";
          if (!hasCurrentDayStats && getLocalDateKey(sessionData.startTime) === this.statsDateKey) {
            this.devicesChargedCount++;
          }
          this.totalEnergyDeliveredKWh += this._calculateSessionEnergyForDay(sessionData, this.statsDateKey, now);
        }
      }

      // Also restore any port overrides
      const savedPorts = this._loadSavedPortStatuses();
      if (savedPorts) {
        for (const [portId, status] of Object.entries(savedPorts)) {
          const port = this.ports.get(portId);
          if (port && !this.activeSessions.has(portId)) {
            // "in-use" is valid only while a matching live session exists.
            port.status = status === "in-use" ? "available" : status;
          }
        }
      }

      this._repairOrphanedPortStates();
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
      if (e.key === STORAGE_KEY_SESSIONS || e.key === STORAGE_KEY_PORTS || e.key === STORAGE_KEY_STATS) {
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
      this._ensureCurrentDay();
      const remaining = Math.max(0, Math.round((session.endTime - now) / 1000));
      session.remainingSeconds = remaining;
      const elapsedSeconds = Math.max(0, Math.min(session.totalSeconds, (now - session.startTime) / 1000));
      session.energyKWh = session.watts * elapsedSeconds / 3600000;

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

    if (this._repairOrphanedPortStates(true)) changed = true;

    if (changed) {
      this._saveToStorage();
    }
  }

  /**
   * Sync active state if another tab or window made changes
   */
  _syncFromExternalStorage() {
    const savedStats = this._loadSavedStats();
    if (savedStats?.dateKey === getLocalDateKey()) {
      this.statsDateKey = savedStats.dateKey;
      this.devicesChargedCount = Number(savedStats.devicesChargedCount) || 0;
      this.totalEnergyDeliveredKWh = Number(savedStats.totalEnergyDeliveredKWh) || 0;
    }
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

    this._repairOrphanedPortStates(true);
    this._reconcileActiveConnectionCount();
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
        schemaVersion: 2,
        dateKey: this.statsDateKey,
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

  _repairOrphanedPortStates(dispatchChanges = false) {
    let changed = false;
    for (const port of this.ports.values()) {
      if (port.status !== "in-use" || this.activeSessions.has(port.id)) continue;
      port.status = "available";
      changed = true;
      if (dispatchChanges) {
        this._dispatch("port-status-changed", { port, session: null });
      }
    }
    return changed;
  }

  _calculateSessionEnergyForDay(session, dateKey = this.statsDateKey, now = Date.now()) {
    const { start, end } = getLocalDayBounds(dateKey);
    const activeStart = Math.max(Number(session.startTime) || 0, start);
    const activeEnd = Math.min(Number(session.endTime) || now, now, end);
    const seconds = Math.max(0, (activeEnd - activeStart) / 1000);
    return (Number(session.watts) || 0) * seconds / 3600000;
  }

  _reconcileActiveConnectionCount() {
    const activeToday = Array.from(this.activeSessions.values()).filter((session) => {
      return getLocalDateKey(session.startTime) === this.statsDateKey
        || (Number(session.startTime) < getLocalDayBounds(this.statsDateKey).start && Number(session.endTime) > getLocalDayBounds(this.statsDateKey).start);
    }).length;

    if (this.devicesChargedCount >= activeToday) return false;
    this.devicesChargedCount = activeToday;
    return true;
  }

  _ensureCurrentDay() {
    const currentDateKey = getLocalDateKey();
    if (this.statsDateKey === currentDateKey) return false;

    this.statsDateKey = currentDateKey;
    this.devicesChargedCount = this.activeSessions.size;
    this.totalEnergyDeliveredKWh = 0;
    this._saveToStorage();
    this._dispatch("daily-stats-changed", this.getDailyStats());
    return true;
  }

  getDailyStats() {
    this._ensureCurrentDay();
    const repairedPorts = this._repairOrphanedPortStates();
    const reconciledCount = this._reconcileActiveConnectionCount();
    if (repairedPorts || reconciledCount) {
      this._saveToStorage(false);
    }
    let activeEnergyKWh = 0;
    for (const session of this.activeSessions.values()) {
      activeEnergyKWh += this._calculateSessionEnergyForDay(session);
    }
    return {
      dateKey: this.statsDateKey,
      devicesConnected: this.devicesChargedCount,
      energyDeliveredKWh: this.totalEnergyDeliveredKWh + activeEnergyKWh,
    };
  }

  getLiveOutputTelemetry(timestamp = Date.now()) {
    let acPowerW = 0;
    let dcPowerW = 0;
    let nominalDemandW = 0;

    for (const session of this.activeSessions.values()) {
      const nominalWatts = Math.max(0, Number(session.watts) || 0);
      const phase = Array.from(session.portId || "").reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const liveWatts = nominalWatts * (0.97 + Math.sin(timestamp / 3500 + phase) * 0.03);
      nominalDemandW += nominalWatts;

      if (session.portType === "outlet") acPowerW += liveWatts;
      else dcPowerW += liveWatts;
    }

    const totalPowerW = acPowerW + dcPowerW;
    const acVoltageV = acPowerW > 0
      ? 220 - Math.min(2.5, acPowerW * 0.008) + Math.sin(timestamp / 4200) * 0.35
      : 0;
    const dcVoltageV = dcPowerW > 0
      ? 5 - Math.min(0.15, dcPowerW * 0.0015) + Math.sin(timestamp / 3100) * 0.025
      : 0;
    return {
      source: "active-session-simulation",
      activeChannels: this.activeSessions.size,
      demandPowerW: nominalDemandW,
      totalPowerW,
      ac: {
        voltageV: acVoltageV,
        currentA: acVoltageV > 0 ? acPowerW / acVoltageV : 0,
        powerW: acPowerW,
      },
      dc: {
        voltageV: dcVoltageV,
        currentA: dcVoltageV > 0 ? dcPowerW / dcVoltageV : 0,
        powerW: dcPowerW,
      },
    };
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
  async startSession(portId, durationMinutes, method = "Cash", device = "Phone") {
    this._ensureCurrentDay();
    const port = this.getPort(portId);
    if (!port) {
      throw new Error(`Port "${portId}" not found.`);
    }

    // The shared API is authoritative even after a temporary polling failure.
    if (typeof fetch === "function") {
      const response = await fetch(SHARED_SESSIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portId,
          portName: port.name,
          portType: port.type,
          spec: port.spec,
          durationMinutes,
          method,
          device,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (Array.isArray(payload.sessions)) {
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(payload.sessions));
          this._syncFromExternalStorage();
        }
        throw new Error(payload.error || "Unable to reserve this port.");
      }
      this.sharedSyncAvailable = true;
      const serverSession = payload.session;
      port.status = "in-use";
      const session = { ...serverSession, timerId: null };
      this.activeSessions.set(portId, session);
      this.devicesChargedCount++;
      this._saveToStorage();
      this._dispatch("port-status-changed", { port, session });
      this._startSessionTimer(session);
      return session;
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
    this.devicesChargedCount++;
    this._saveToStorage();
    this._dispatch("port-status-changed", { port, session });
    this._startSessionTimer(session);

    return session;
  }

  /**
   * Complete or stop a charging session
   */
  async completeSession(portId, naturalFinish = false) {
    const session = this.activeSessions.get(portId);
    if (session) {
      clearInterval(session.timerId);
      this.activeSessions.delete(portId);
    }

    const port = this.getPort(portId);
    if (port) {
      port.status = "available";
      if (session) {
        this._ensureCurrentDay();
        this.totalEnergyDeliveredKWh += this._calculateSessionEnergyForDay(session);
      }
      this._saveToStorage();
      this._dispatch("port-status-changed", { port, session: null });
      this._dispatch("session-completed", { port, session, naturalFinish });
    }

    if (typeof fetch === "function") {
      try {
        const response = await fetch(SHARED_SESSIONS_URL, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portId }),
        });
        if (!response.ok) throw new Error(`Shared release returned ${response.status}`);
      } catch (error) {
        console.warn("CampusVolt: Could not release the shared port", error);
      }
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
