/**
 * CampusVolt Dashboard - Charging Modal Module
 * Matches Figma specifications:
 * 1. 4-step sequence: (1) Pay — (2) Confirm — (3) Connect — (4) Charging [X]
 * 2. Select Payment Method (Cash / GCash cards)
 * 3. Sub-steps with "< Back" button for inserting coins / scanning QR
 * 4. In-use port overlay with 15:00 countdown, linear progress bar, 2x2 session telemetry, and Done button.
 * 5. Full bilingual translation (English / Filipino).
 */

import { PRICING_CONFIG } from "./ports-config.js";
import { i18n } from "./i18n.js";

export class ChargingModal {
  constructor(state) {
    this.state = state;
    this.dialog = null;
    this.currentPort = null;
    this.selectedMethod = "Cash"; // "Cash" | "GCash"
    this.selectedDuration = 15; // default 15 mins (₱15)
    this.insertedCoins = 15;
    this.activeStep = "pay-select"; // "pay-select" | "pay-cash" | "pay-gcash" | "confirm" | "connect" | "charging"
    this.activeSession = null;

    this._ensureDialogElement();
    this._bindGlobalEvents();
  }

  _ensureDialogElement() {
    let dialog = document.getElementById("charging-modal");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "charging-modal";
      dialog.className = "charging-modal";
      dialog.setAttribute("aria-modal", "true");
      document.body.appendChild(dialog);
    }
    this.dialog = dialog;

    // Close on backdrop click (only when directly clicking on the dialog backdrop outside modal-card)
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) {
        this.close();
      }
    });

    // Close on ESC key
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
  }

  _bindGlobalEvents() {
    this.state.addEventListener("session-tick", (e) => {
      const session = e.detail.session;
      if (this.currentPort && session.portId === this.currentPort.id && this.activeStep === "charging") {
        this._updateActiveTimerView(session);
      }
    });

    this.state.addEventListener("session-completed", (e) => {
      const { port, session } = e.detail;
      if (this.currentPort && port.id === this.currentPort.id && this.activeStep === "charging") {
        this.close();
      }
    });

    i18n.addEventListener("language-changed", () => {
      if (this.dialog && this.dialog.open && this.currentPort) {
        this._renderCurrentStep();
      }
    });
  }

  /**
   * Open modal for a specific port
   */
  openForPort(portId) {
    const port = this.state.getPort(portId);
    if (!port) return;

    this.currentPort = port;
    const existingSession = this.state.getSession(portId);

    if (port.status === "in-use" || existingSession) {
      // In-use port clicked: open overlay directly matching Screenshot 3!
      this.activeSession = existingSession || {
        portId: port.id,
        portName: port.name,
        device: "Phone",
        watts: 9,
        paid: "₱15 · Cash",
        durationMinutes: 15,
        totalSeconds: 900,
        remainingSeconds: 900,
      };
      this.showChargingStep(this.activeSession);
    } else {
      // Available port clicked: open Step 1 (Select Payment Method) matching Screenshot 1!
      this.selectedMethod = "Cash";
      this.selectedDuration = 15;
      this.insertedCoins = 15;
      this.showPaySelectStep();
    }

    if (!this.dialog.open) {
      this.dialog.showModal();
    }
  }

  close() {
    if (this.dialog && this.dialog.open) {
      this.dialog.close();
    }
  }

  /**
   * Render top 4-step progress header:
   * (1) Pay — (2) Confirm — (3) Connect — (4) Charging [X]
   */
  _renderStepsHeader(activeStepNumber) {
    const t = (k) => i18n.t(k);
    const steps = [
      { num: 1, label: t("step_pay") },
      { num: 2, label: t("step_confirm") },
      { num: 3, label: t("step_connect") },
      { num: 4, label: t("step_charging") },
    ];

    return `
      <header class="modal-steps-header">
        <div class="modal-steps-list" role="progressbar" aria-valuenow="${activeStepNumber}" aria-valuemin="1" aria-valuemax="4">
          ${steps.map((s, idx) => {
            const isActive = s.num === activeStepNumber;
            const isCompleted = s.num < activeStepNumber;
            let statusClass = "modal-step--pending";
            if (isActive) statusClass = "modal-step--active";
            else if (isCompleted) statusClass = "modal-step--completed";

            return `
              <div class="modal-step ${statusClass}">
                <span class="step-num">${s.num}</span>
                <span class="step-text">${s.label}</span>
              </div>
              ${idx < steps.length - 1 ? `<span class="step-divider" aria-hidden="true">—</span>` : ""}
            `;
          }).join("")}
        </div>
        <button type="button" class="modal-close-icon-btn" id="modal-close-btn" aria-label="Close dialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>
    `;
  }

  /**
   * STEP 1: Select Payment Method (Figma Main Design)
   */
  showPaySelectStep() {
    this.activeStep = "pay-select";
    const port = this.currentPort;
    const t = (k) => i18n.t(k);

    this.dialog.innerHTML = `
      <div class="modal-card">
        ${this._renderStepsHeader(1)}

        <div class="modal-body modal-body--pay-select">
          <div class="port-title-row">
            <h2 class="modal-port-name">${port.name}</h2>
            <span class="port-status-pill port-status-pill--available">${t("status_available")}</span>
          </div>

          <p class="modal-instructions">
            ${t("modal_choose_pay")} <strong>${t("modal_rate_notice")}</strong>
          </p>

          <div class="payment-methods-grid" role="group" aria-label="Select payment method">
            <!-- Cash Option -->
            <button type="button" class="payment-method-card" id="btn-select-cash" data-method="Cash">
              <div class="payment-method-icon payment-method-icon--cash" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 7v10M9 9h6M9 12h6"/>
                </svg>
              </div>
              <h3 class="payment-method-title">${t("modal_cash_title")}</h3>
              <p class="payment-method-sub">${t("modal_cash_sub")}</p>
            </button>

            <!-- GCash Option -->
            <button type="button" class="payment-method-card" id="btn-select-gcash" data-method="GCash">
              <div class="payment-method-icon payment-method-icon--gcash" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                  <path d="M14 14h2v2h-2zM18 14h3v3h-3zM14 18h3v3h-3zM19 19v2M14 16v2"/>
                </svg>
              </div>
              <h3 class="payment-method-title">${t("modal_gcash_title")}</h3>
              <p class="payment-method-sub">${t("modal_gcash_sub")}</p>
            </button>
          </div>

          <p class="modal-footer-caption">
            ${t("modal_footer_caption")}
          </p>
        </div>
      </div>
    `;

    this.dialog.querySelector("#modal-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });

    this.dialog.querySelector("#btn-select-cash")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectedMethod = "Cash";
      this.insertedCoins = this.selectedDuration || 15;
      this.showPayCashStep();
    });

    this.dialog.querySelector("#btn-select-gcash")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectedMethod = "GCash";
      this.showPayGCashStep();
    });
  }

  /**
   * STEP 1.1: Cash Flow - Insert Coins & Linear Adjustment with "< Back" button (Screenshot 4)
   */
  showPayCashStep() {
    this.activeStep = "pay-cash";
    const port = this.currentPort;
    const t = (k) => i18n.t(k);

    this.dialog.innerHTML = `
      <div class="modal-card">
        ${this._renderStepsHeader(1)}

        <div class="modal-body modal-body--cash">
          <button type="button" class="modal-back-btn" id="modal-back-btn" aria-label="Go back to payment selection">
            ${t("btn_back")}
          </button>

          <h2 class="modal-section-title">${t("cash_insert_title")}</h2>
          <p class="modal-instructions">${t("cash_insert_desc")}</p>

          <div class="coins-simulator-box">
            <div class="coin-display-balance">
              <span class="coin-balance-label">${t("cash_total_label")}</span>
              <span class="coin-balance-val" id="coin-balance-val">₱${this.insertedCoins}</span>
              <span class="coin-minutes-val" id="coin-minutes-val">${this.insertedCoins} ${t("cash_mins_suffix")}</span>
            </div>

            <!-- Linear Coin & Time Slider -->
            <div class="modal-linear-slider-wrapper" style="margin-block: 8px 4px;">
              <input 
                type="range" 
                id="cash-linear-slider" 
                class="modal-linear-slider" 
                min="5" 
                max="120" 
                step="1" 
                value="${Math.max(5, Math.min(120, this.insertedCoins))}" 
                aria-label="Linear price and time adjustment slider"
              >
              <div class="slider-ticks">
                <span>₱5 (5m)</span>
                <span>₱30 (30m)</span>
                <span>₱60 (60m)</span>
                <span>₱90 (90m)</span>
                <span>₱120 (120m)</span>
              </div>
            </div>

            <div class="coin-buttons" role="group" aria-label="Coin insertion buttons">
              <button type="button" class="coin-btn" data-coin="1">+ ₱1</button>
              <button type="button" class="coin-btn" data-coin="5">+ ₱5</button>
              <button type="button" class="coin-btn coin-btn--recommended" data-coin="10">+ ₱10</button>
              <button type="button" class="coin-btn" data-coin="20">+ ₱20</button>
            </div>
          </div>

          <button type="button" class="btn btn--primary btn--full" id="confirm-coins-btn">
            ${t("cash_proceed_btn")} (₱${this.insertedCoins})
          </button>
        </div>
      </div>
    `;

    this.dialog.querySelector("#modal-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    this.dialog.querySelector("#modal-back-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showPaySelectStep();
    });

    const balEl = this.dialog.querySelector("#coin-balance-val");
    const minEl = this.dialog.querySelector("#coin-minutes-val");
    const procBtn = this.dialog.querySelector("#confirm-coins-btn");
    const cashSlider = this.dialog.querySelector("#cash-linear-slider");

    const updateCashDisplays = () => {
      if (balEl) balEl.textContent = `₱${this.insertedCoins}`;
      if (minEl) minEl.textContent = `${this.insertedCoins} ${t("cash_mins_suffix")}`;
      if (procBtn) procBtn.textContent = `${t("cash_proceed_btn")} (₱${this.insertedCoins})`;
      if (cashSlider) cashSlider.value = Math.max(5, Math.min(120, this.insertedCoins));
    };

    cashSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.insertedCoins = val;
      this.selectedDuration = val;
      updateCashDisplays();
    });

    this.dialog.querySelectorAll(".coin-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.coin, 10);
        this.insertedCoins = Math.min(120, Math.max(5, (this.insertedCoins || 0) + val));
        this.selectedDuration = this.insertedCoins;
        updateCashDisplays();
      });
    });

    this.dialog.querySelector("#confirm-coins-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectedMethod = "Cash";
      this.selectedDuration = this.insertedCoins;
      this.showConfirmStep();
    });
  }

  /**
   * STEP 1.2: GCash Flow - Aligned with Cash UI Design + QR code
   */
  showPayGCashStep() {
    this.activeStep = "pay-gcash";
    const port = this.currentPort;
    const t = (k) => i18n.t(k);

    this.dialog.innerHTML = `
      <div class="modal-card">
        ${this._renderStepsHeader(1)}

        <div class="modal-body modal-body--gcash">
          <button type="button" class="modal-back-btn" id="modal-back-btn" aria-label="Go back to payment selection">
            ${t("btn_back")}
          </button>

          <h2 class="modal-section-title">${t("gcash_qr_title")}</h2>
          <p class="modal-instructions">${t("gcash_qr_desc")}</p>

          <!-- Price & Time Selector Box (Formatted identically to Cash UI) -->
          <div class="coins-simulator-box" style="margin-bottom: 14px;">
            <div class="coin-display-balance">
              <span class="coin-balance-label">${t("gcash_total_label")}</span>
              <span class="coin-balance-val" id="gcash-balance-val">₱${this.selectedDuration}</span>
              <span class="coin-minutes-val" id="gcash-minutes-val">${this.selectedDuration} ${t("cash_mins_suffix")}</span>
            </div>

            <!-- Linear Price & Time Slider -->
            <div class="modal-linear-slider-wrapper" style="margin-block: 8px 4px;">
              <input 
                type="range" 
                id="gcash-linear-slider" 
                class="modal-linear-slider" 
                min="5" 
                max="120" 
                step="1" 
                value="${Math.max(5, Math.min(120, this.selectedDuration))}" 
                aria-label="Linear price and time adjustment slider"
              >
              <div class="slider-ticks">
                <span>₱5 (5m)</span>
                <span>₱30 (30m)</span>
                <span>₱60 (60m)</span>
                <span>₱90 (90m)</span>
                <span>₱120 (120m)</span>
              </div>
            </div>

            <!-- Incremental Buttons identical to Cash (+ ₱1, + ₱5, + ₱10, + ₱20) -->
            <div class="coin-buttons" role="group" aria-label="Amount increment buttons">
              <button type="button" class="coin-btn gcash-coin-btn" data-coin="1">+ ₱1</button>
              <button type="button" class="coin-btn gcash-coin-btn" data-coin="5">+ ₱5</button>
              <button type="button" class="coin-btn gcash-coin-btn coin-btn--recommended" data-coin="10">+ ₱10</button>
              <button type="button" class="coin-btn gcash-coin-btn" data-coin="20">+ ₱20</button>
            </div>
          </div>

          <!-- Stylized QR Code Box -->
          <div class="qr-container" style="margin-bottom: 14px;">
            <div class="qr-box">
              <svg class="qr-svg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="160" height="160" fill="#ffffff" rx="8"/>
                <rect x="14" y="14" width="36" height="36" fill="#0c1d1b" rx="4"/>
                <rect x="20" y="20" width="24" height="24" fill="#ffffff" rx="2"/>
                <rect x="25" y="25" width="14" height="14" fill="#12969b" rx="2"/>

                <rect x="110" y="14" width="36" height="36" fill="#0c1d1b" rx="4"/>
                <rect x="116" y="20" width="24" height="24" fill="#ffffff" rx="2"/>
                <rect x="121" y="25" width="14" height="14" fill="#12969b" rx="2"/>

                <rect x="14" y="110" width="36" height="36" fill="#0c1d1b" rx="4"/>
                <rect x="20" y="116" width="24" height="24" fill="#ffffff" rx="2"/>
                <rect x="25" y="121" width="14" height="14" fill="#12969b" rx="2"/>

                <g fill="#0c1d1b">
                  <rect x="58" y="18" width="8" height="8" rx="1"/>
                  <rect x="74" y="18" width="8" height="8" rx="1"/>
                  <rect x="90" y="18" width="8" height="8" rx="1"/>
                  <rect x="58" y="34" width="16" height="8" rx="1"/>
                  <rect x="82" y="34" width="8" height="8" rx="1"/>
                  <rect x="58" y="50" width="8" height="8" rx="1"/>
                  <rect x="74" y="50" width="16" height="8" rx="1"/>
                  <rect x="98" y="50" width="8" height="8" rx="1"/>
                  <rect x="18" y="58" width="8" height="16" rx="1"/>
                  <rect x="34" y="58" width="16" height="8" rx="1"/>
                  <rect x="18" y="82" width="16" height="8" rx="1"/>
                  <rect x="42" y="74" width="8" height="16" rx="1"/>
                  <rect x="114" y="58" width="8" height="8" rx="1"/>
                  <rect x="130" y="58" width="16" height="8" rx="1"/>
                  <rect x="114" y="74" width="16" height="8" rx="1"/>
                  <rect x="138" y="74" width="8" height="16" rx="1"/>
                  <rect x="58" y="114" width="16" height="8" rx="1"/>
                  <rect x="82" y="114" width="8" height="8" rx="1"/>
                  <rect x="58" y="130" width="8" height="16" rx="1"/>
                  <rect x="74" y="138" width="16" height="8" rx="1"/>
                  <rect x="98" y="130" width="8" height="8" rx="1"/>
                  <rect x="114" y="114" width="8" height="16" rx="1"/>
                  <rect x="130" y="122" width="16" height="8" rx="1"/>
                  <rect x="122" y="138" width="8" height="8" rx="1"/>
                  <rect x="138" y="138" width="8" height="8" rx="1"/>
                </g>

                <circle cx="80" cy="80" r="16" fill="#12969b"/>
                <path d="M80 72L74 81H78.5L78 88L85 79H80.5L80 72Z" fill="#ffffff"/>
              </svg>
            </div>
            <div class="qr-methods">
              <span class="qr-method-pill">GCash</span>
              <span class="qr-method-pill">Maya</span>
              <span class="qr-method-pill">QRPH</span>
            </div>
          </div>

          <button type="button" class="btn btn--primary btn--full" id="confirm-gcash-btn">
            ${t("gcash_proceed_btn")} (₱${this.selectedDuration})
          </button>
        </div>
      </div>
    `;

    this.dialog.querySelector("#modal-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    this.dialog.querySelector("#modal-back-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showPaySelectStep();
    });

    const gcashSlider = this.dialog.querySelector("#gcash-linear-slider");
    const balEl = this.dialog.querySelector("#gcash-balance-val");
    const minEl = this.dialog.querySelector("#gcash-minutes-val");
    const procBtn = this.dialog.querySelector("#confirm-gcash-btn");

    const updateGCashDisplays = () => {
      if (balEl) balEl.textContent = `₱${this.selectedDuration}`;
      if (minEl) minEl.textContent = `${this.selectedDuration} ${t("cash_mins_suffix")}`;
      if (procBtn) procBtn.textContent = `${t("gcash_proceed_btn")} (₱${this.selectedDuration})`;
      if (gcashSlider) gcashSlider.value = Math.max(5, Math.min(120, this.selectedDuration));
    };

    gcashSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.selectedDuration = val;
      updateGCashDisplays();
    });

    this.dialog.querySelectorAll(".gcash-coin-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.coin, 10);
        this.selectedDuration = Math.min(120, Math.max(5, (this.selectedDuration || 0) + val));
        updateGCashDisplays();
      });
    });

    this.dialog.querySelector("#confirm-gcash-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectedMethod = "GCash";
      this.showConfirmStep();
    });
  }

  /**
   * STEP 2: Confirm Step
   */
  showConfirmStep() {
    this.activeStep = "confirm";
    const port = this.currentPort;
    const t = (k) => i18n.t(k);
    const amount = this.selectedDuration;

    this.dialog.innerHTML = `
      <div class="modal-card">
        ${this._renderStepsHeader(2)}

        <div class="modal-body modal-body--confirm">
          <button type="button" class="modal-back-btn" id="modal-back-btn" aria-label="Go back to edit payment">
            ${t("btn_back")}
          </button>

          <h2 class="modal-section-title">${t("confirm_title")}</h2>
          <p class="modal-instructions">${t("confirm_desc")}</p>

          <div class="confirm-summary-card">
            <div class="confirm-row">
              <span class="confirm-label">${t("confirm_port_label")}</span>
              <strong class="confirm-val">${port.name}</strong>
            </div>
            <div class="confirm-row">
              <span class="confirm-label">${t("confirm_method_label")}</span>
              <strong class="confirm-val">${this.selectedMethod}</strong>
            </div>
            <div class="confirm-row">
              <span class="confirm-label">${t("confirm_duration_label")}</span>
              <strong class="confirm-val">${this.selectedDuration} mins</strong>
            </div>
            <div class="confirm-row confirm-row--total">
              <span class="confirm-label">${t("confirm_total_label")}</span>
              <strong class="confirm-val confirm-val--accent">₱${amount}.00</strong>
            </div>
          </div>

          <button type="button" class="btn btn--primary btn--full" id="confirm-next-btn">
            ${t("confirm_proceed_btn")}
          </button>
        </div>
      </div>
    `;

    this.dialog.querySelector("#modal-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    this.dialog.querySelector("#modal-back-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.selectedMethod === "Cash") this.showPayCashStep();
      else this.showPayGCashStep();
    });
    this.dialog.querySelector("#confirm-next-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showConnectStep();
    });
  }

  /**
   * STEP 3: Connect Step
   */
  showConnectStep() {
    this.activeStep = "connect";
    const port = this.currentPort;
    const t = (k) => i18n.t(k);

    this.dialog.innerHTML = `
      <div class="modal-card">
        ${this._renderStepsHeader(3)}

        <div class="modal-body modal-body--connect">
          <button type="button" class="modal-back-btn" id="modal-back-btn" aria-label="Go back to confirm step">
            ${t("btn_back")}
          </button>

          <h2 class="modal-section-title">${t("connect_title")}</h2>
          <p class="modal-instructions">${t("connect_desc")}</p>

          <div class="connect-illustration">
            <div class="connect-icon-pulse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 12h-5m0 0l3-3m-3 3l3 3M6 12h5m0 0l-3-3m3 3l-3 3"/>
              </svg>
            </div>
            <span class="connect-port-badge">${port.name}</span>
          </div>

          <button type="button" class="btn btn--primary btn--full" id="start-charging-btn">
            ${t("connect_btn")}
          </button>
        </div>
      </div>
    `;

    this.dialog.querySelector("#modal-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    this.dialog.querySelector("#modal-back-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showConfirmStep();
    });
    this.dialog.querySelector("#start-charging-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const button = e.currentTarget;
      button.disabled = true;
      button.textContent = "Reserving port...";
      try {
        const session = await this.state.startSession(
          this.currentPort.id,
          this.selectedDuration,
          this.selectedMethod,
          "Phone"
        );
        this.activeSession = session;
        this.showChargingStep(session);
      } catch (error) {
        button.disabled = false;
        button.textContent = error.message || "Unable to reserve port";
        button.title = error.message || "Unable to reserve port";
        if (/already in use/i.test(error.message || "")) {
          setTimeout(() => this.close(), 1800);
        }
      }
    });
  }

  /**
   * STEP 4: Active Charging Session Overlay (Screenshot 3)
   */
  showChargingStep(session) {
    this.activeStep = "charging";
    this.activeSession = session;
    const port = this.currentPort || this.state.getPort(session.portId);
    const t = (k) => i18n.t(k);

    const m = Math.floor(session.remainingSeconds / 60);
    const s = session.remainingSeconds % 60;
    const timeFormatted = `${m}:${s < 10 ? "0" : ""}${s}`;
    const progressPercent = Math.max(0, Math.min(100, (session.remainingSeconds / session.totalSeconds) * 100));

    this.dialog.innerHTML = `
      <div class="modal-card">
        ${this._renderStepsHeader(4)}

        <div class="modal-body modal-body--charging">
          <!-- Port Title Row with In-use Pill -->
          <div class="port-title-row">
            <h2 class="modal-port-name">${port.name}</h2>
            <span class="port-status-pill port-status-pill--in-use">${t("status_in_use")}</span>
          </div>

          <!-- Big Countdown Timer Display -->
          <div class="charging-timer-display">
            <span class="charging-timer-val" id="charging-timer-val">${timeFormatted}</span>
            <span class="charging-timer-sub">${t("active_time_remaining")}</span>
          </div>

          <!-- Linear Gradient Progress Bar -->
          <div class="charging-linear-progress" role="progressbar" aria-valuenow="${Math.round(progressPercent)}" aria-valuemin="0" aria-valuemax="100">
            <div class="charging-linear-fill" id="charging-linear-fill" style="width: ${progressPercent}%;"></div>
          </div>

          <!-- 2x2 Telemetry Grid (Phone / 9W / Paid / Port) -->
          <div class="charging-stats-2x2">
            <div class="charging-stat-box">
              <span class="charging-stat-label">${t("active_device_detected")}</span>
              <strong class="charging-stat-val" id="stat-device">${session.device || "Phone"}</strong>
            </div>

            <div class="charging-stat-box">
              <span class="charging-stat-label">${t("active_power_draw")}</span>
              <strong class="charging-stat-val" id="stat-watts">${session.watts || 9} W</strong>
            </div>

            <div class="charging-stat-box">
              <span class="charging-stat-label">${t("active_paid")}</span>
              <strong class="charging-stat-val">${session.paid || "₱15 · Cash"}</strong>
            </div>

            <div class="charging-stat-box">
              <span class="charging-stat-label">${t("active_port")}</span>
              <strong class="charging-stat-val">${port.name}</strong>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="charging-actions-group">
            <button type="button" class="btn--done" id="charging-done-btn">
              ${t("active_btn_done")}
            </button>
            <button type="button" class="btn--stop" id="charging-stop-btn">
              Stop charging early
            </button>
          </div>

          <!-- Footnote -->
          <p class="charging-footer-note">
            ${t("active_footer_caption")}
          </p>
        </div>
      </div>
    `;

    this.dialog.querySelector("#modal-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    this.dialog.querySelector("#charging-done-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });
    this.dialog.querySelector("#charging-stop-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const portId = this.currentPort ? this.currentPort.id : (session ? session.portId : null);
      if (portId) {
        this.state.completeSession(portId, false);
      }
      this.close();
    });
  }

  _updateActiveTimerView(session) {
    const timerVal = this.dialog.querySelector("#charging-timer-val");
    const progressFill = this.dialog.querySelector("#charging-linear-fill");
    const wattsVal = this.dialog.querySelector("#stat-watts");

    const m = Math.floor(session.remainingSeconds / 60);
    const s = session.remainingSeconds % 60;
    const timeFormatted = `${m}:${s < 10 ? "0" : ""}${s}`;
    const progressPercent = Math.max(0, Math.min(100, (session.remainingSeconds / session.totalSeconds) * 100));

    if (timerVal) timerVal.textContent = timeFormatted;
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (wattsVal) {
      // Subtle natural fluctuation
      const fluc = (session.watts || 9) + Math.floor((Math.random() - 0.5) * 2);
      wattsVal.textContent = `${fluc} W`;
    }
  }

  _renderCurrentStep() {
    switch (this.activeStep) {
      case "pay-select":
        this.showPaySelectStep();
        break;
      case "pay-cash":
        this.showPayCashStep();
        break;
      case "pay-gcash":
        this.showPayGCashStep();
        break;
      case "confirm":
        this.showConfirmStep();
        break;
      case "connect":
        this.showConnectStep();
        break;
      case "charging":
        if (this.activeSession) this.showChargingStep(this.activeSession);
        break;
    }
  }
}
