/**
 * CampusVolt Dashboard - Ports Renderer Module
 * Converts Figma UI specifications into clean, semantic, responsive HTML/CSS structures.
 * Supports efficient granular DOM updates for real-time status transitions and bilingual i18n.
 */

import { PORT_CATEGORIES, PRICING_CONFIG } from "./ports-config.js";
import { getPortIcon } from "./ports-icons.js";
import { i18n } from "./i18n.js";

export class PortsRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = null;

    i18n.addEventListener("language-changed", () => {
      if (this.state) {
        this.render(this.state);
      }
    });
  }

  /**
   * Renders the complete charging ports section into the container
   * @param {import('./ports-state.js').PortsStateManager} state
   */
  render(state) {
    if (!this.container) return;
    this.state = state;

    this.container.innerHTML = `
      <!-- ================= FIGMA MAIN DASHBOARD HEADER ================= -->
      <header class="ports-header">
        <h1 class="ports-header__title" data-i18n="dash_title">${i18n.t("dash_title")}</h1>
        <p class="ports-header__subtitle">
          <span data-i18n="dash_subtitle_prefix">${i18n.t("dash_subtitle_prefix")}</span><span class="ports-header__price-highlight" data-i18n="dash_price_rate">${i18n.t("dash_price_rate")}</span>
        </p>
      </header>

      <div class="ports-subbar">
        <span class="ports-subbar__label" data-i18n="dash_subbar_label">${i18n.t("dash_subbar_label")}</span>
        <span class="ports-subbar__note" data-i18n="dash_subbar_note">${i18n.t("dash_subbar_note")}</span>
      </div>

      <!-- ================= PORT CATEGORIES & CARDS ================= -->
      <div class="ports-categories">
        ${PORT_CATEGORIES.map(category => this._renderCategory(category, state)).join("")}
      </div>
    `;
  }

  /**
   * Render a category block
   */
  _renderCategory(category, state) {
    const catKey = "cat_" + category.id.replace("-", "_");
    const catTitle = i18n.t(catKey) || category.title;

    return `
      <section class="port-category" aria-labelledby="cat-heading-${category.id}">
        <div class="port-category__header">
          <h3 class="port-category__title" id="cat-heading-${category.id}" data-i18n="${catKey}">${catTitle}</h3>
        </div>
        <div class="port-category__grid">
          ${category.ports.map(portDef => {
            const currentPort = state.getPort(portDef.id) || portDef;
            return this._renderPortCard(currentPort, state);
          }).join("")}
        </div>
      </section>
    `;
  }

  /**
   * Render an individual port card matching Figma specs
   */
  _renderPortCard(port, state) {
    const isAvailable = port.status === "available";
    const session = state.getSession(port.id);
    const cardStatusClass = isAvailable ? "port-card--available" : "port-card--in-use";
    const ariaRole = 'role="button" tabindex="0"';
    const ariaLabel = isAvailable 
      ? `${port.name}, Available at ${PRICING_CONFIG.currencySymbol}${PRICING_CONFIG.ratePerMinute}/min. Press to start charging.`
      : `${port.name}, Currently in use. Press to view active session.`;

    const statusText = isAvailable ? i18n.t("status_available") : i18n.t("status_in_use");

    return `
      <article 
        class="port-card ${cardStatusClass}" 
        id="port-card-${port.id}" 
        data-port-id="${port.id}"
        data-status="${port.status}"
        ${ariaRole}
        aria-label="${ariaLabel}"
      >
        <div class="port-card__icon-box" aria-hidden="true">
          ${getPortIcon(port.type)}
        </div>

        <div class="port-card__content">
          <h4 class="port-card__name">${port.name}</h4>
          <div class="port-card__meta">
            <span class="port-pill port-pill--${port.status}" id="pill-${port.id}">
              ${statusText}
            </span>
            ${session ? `<span class="port-card__timer-snippet" id="snippet-${port.id}">${this._formatSnippet(session.remainingSeconds)}</span>` : ""}
          </div>
        </div>

        ${isAvailable ? `
          <div class="port-card__action" aria-hidden="true">
            <span class="port-card__chevron">›</span>
          </div>
        ` : `
          <div class="port-card__busy-indicator" aria-hidden="true" title="Currently occupied">
            <span class="busy-dot"></span>
          </div>
        `}
      </article>
    `;
  }

  /**
   * Surgical update of a single port card when its status changes
   */
  updatePortCard(port, state) {
    const card = document.getElementById(`port-card-${port.id}`);
    if (!card) return;

    const isAvailable = port.status === "available";
    const session = state.getSession(port.id);

    // Toggle classes
    card.classList.toggle("port-card--available", isAvailable);
    card.classList.toggle("port-card--in-use", !isAvailable);
    card.dataset.status = port.status;

    // Update pill
    const pill = document.getElementById(`pill-${port.id}`);
    if (pill) {
      pill.className = `port-pill port-pill--${port.status}`;
      pill.textContent = isAvailable ? i18n.t("status_available") : i18n.t("status_in_use");
    }

    // Update timer snippet
    let snippet = document.getElementById(`snippet-${port.id}`);
    if (session) {
      if (!snippet) {
        snippet = document.createElement("span");
        snippet.id = `snippet-${port.id}`;
        snippet.className = "port-card__timer-snippet";
        card.querySelector(".port-card__meta")?.appendChild(snippet);
      }
      snippet.textContent = this._formatSnippet(session.remainingSeconds);
    } else if (snippet) {
      snippet.remove();
    }

    // Update action element
    const actionEl = card.querySelector(".port-card__action, .port-card__busy-indicator");
    if (actionEl) {
      if (isAvailable) {
        actionEl.className = "port-card__action";
        actionEl.innerHTML = '<span class="port-card__chevron">›</span>';
      } else {
        actionEl.className = "port-card__busy-indicator";
        actionEl.innerHTML = '<span class="busy-dot"></span>';
      }
    }
  }

  /**
   * Format mm:ss snippet string
   */
  _formatSnippet(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  /**
   * Update active port counter pills across the app
   */
  updateDashboardCounters(state) {
    const activeCount = state.getActiveCount();
    const totalCount = state.getTotalCount();

    const inUseBadge = document.getElementById("active-ports-badge");
    if (inUseBadge) inUseBadge.textContent = `${activeCount} in use`;

    const availBadge = document.getElementById("available-ports-badge");
    if (availBadge) availBadge.textContent = `${totalCount - activeCount} available`;
  }
}
