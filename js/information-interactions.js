const metricCards = [...document.querySelectorAll("[data-metric-card]")];
const modal = document.getElementById("metric-modal");
const modalTitle = document.getElementById("metric-modal-title");
const modalContent = document.getElementById("metric-modal-content");
const modalClose = document.getElementById("metric-modal-close");

const mirroredTelemetry = [
  ["weather-condition", "weather-detail-condition"],
  ["weather-location", "weather-detail-location"],
  ["weather-expected-solar", "weather-detail-solar"],
  ["weather-source", "weather-detail-source"],
];

let activeCard = null;
let activeDetails = null;

function mirrorValue(sourceId, targetId) {
  const source = document.getElementById(sourceId);
  const target = document.getElementById(targetId);
  if (!source || !target) return;

  const sync = () => {
    target.textContent = source.textContent;
  };

  sync();
  new MutationObserver(sync).observe(source, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function syncSolarUtilization() {
  const power = document.getElementById("solar-power-value");
  const peak = document.getElementById("solar-peak-value");
  const utilization = document.getElementById("solar-utilization-value");
  if (!power || !peak || !utilization) return;

  const update = () => {
    const currentPower = Number.parseFloat(power.textContent);
    const peakPower = Number.parseFloat(peak.textContent);
    if (!Number.isFinite(currentPower) || !Number.isFinite(peakPower) || peakPower <= 0) return;

    utilization.textContent = String(Math.round((currentPower / peakPower) * 100));
  };

  update();
  const observer = new MutationObserver(update);
  observer.observe(power, { childList: true, characterData: true, subtree: true });
  observer.observe(peak, { childList: true, characterData: true, subtree: true });
}

function restoreDetails() {
  if (!activeCard || !activeDetails) return;

  activeDetails.hidden = true;
  activeDetails.setAttribute("aria-hidden", "true");
  activeCard.append(activeDetails);
  activeCard.setAttribute("aria-expanded", "false");
  activeCard = null;
  activeDetails = null;
}

function openDetails(card) {
  if (!modal || !modalTitle || !modalContent) return;

  const detailsId = card.getAttribute("aria-controls");
  const details = detailsId ? document.getElementById(detailsId) : null;
  const cardTitle = card.querySelector(".card__title");
  if (!details || !cardTitle) return;

  activeCard = card;
  activeDetails = details;
  modalTitle.textContent = cardTitle.textContent;
  details.hidden = false;
  details.setAttribute("aria-hidden", "false");
  modalContent.append(details);
  card.setAttribute("aria-expanded", "true");
  modal.showModal();
}

function closeDetails() {
  if (modal?.open) modal.close();
}

metricCards.forEach((card) => {
  card.addEventListener("click", () => openDetails(card));
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDetails(card);
  });
});

modalClose?.addEventListener("click", closeDetails);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeDetails();
});

modal?.addEventListener("close", () => {
  const cardToFocus = activeCard;
  restoreDetails();
  cardToFocus?.focus();
});

mirroredTelemetry.forEach(([sourceId, targetId]) => mirrorValue(sourceId, targetId));
syncSolarUtilization();
