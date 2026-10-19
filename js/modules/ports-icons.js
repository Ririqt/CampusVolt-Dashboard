/**
 * CampusVolt Dashboard - Port Icons Module
 * High-fidelity, scalable SVG icons crafted for the new Figma design language.
 */

export const ICONS = {
  // AC Wall Outlet (Universal Socket with two slots & earth pin)
  outlet: `
    <svg class="port-icon-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2.5" y="2.5" width="23" height="23" rx="6" stroke="currentColor" stroke-width="2"/>
      <rect x="7.5" y="8" width="3" height="8" rx="1.5" fill="currentColor"/>
      <rect x="17.5" y="8" width="3" height="8" rx="1.5" fill="currentColor"/>
      <circle cx="14" cy="18" r="1.75" fill="currentColor"/>
    </svg>
  `,

  // USB Type-C plug / socket
  "type-c": `
    <svg class="port-icon-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="8.5" width="22" height="11" rx="5.5" stroke="currentColor" stroke-width="2"/>
      <rect x="8.5" y="12.5" width="11" height="3" rx="1.5" fill="currentColor"/>
    </svg>
  `,

  // Micro USB connector
  "micro-usb": `
    <svg class="port-icon-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9C4 7.89543 4.89543 7 6 7H22C23.1046 7 24 7.89543 24 9V14C24 14.6 23.7 15.2 23.2 15.6L20 18.2C19.4 18.7 18.6 19 17.8 19H10.2C9.4 19 8.6 18.7 8 18.2L4.8 15.6C4.3 15.2 4 14.6 4 14V9Z" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="10.5" width="12" height="2" rx="1" fill="currentColor"/>
      <circle cx="10" cy="15" r="1" fill="currentColor"/>
      <circle cx="18" cy="15" r="1" fill="currentColor"/>
    </svg>
  `,

  // Lightning 8-pin connector
  lightning: `
    <svg class="port-icon-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4.5" y="7" width="19" height="14" rx="4" stroke="currentColor" stroke-width="2"/>
      <line x1="8.5" y1="12" x2="8.5" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="10.5" y1="12" x2="10.5" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="12.5" y1="12" x2="12.5" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="14.5" y1="12" x2="14.5" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="16.5" y1="12" x2="16.5" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="18.5" y1="12" x2="18.5" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,

  // USB-A connector
  "usb-a": `
    <svg class="port-icon-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="6" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2"/>
      <path d="M4 14H24" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="9" width="3" height="3" rx="0.5" fill="currentColor"/>
      <rect x="17" y="9" width="3" height="3" rx="0.5" fill="currentColor"/>
    </svg>
  `,

  // Wireless inductive Qi charging pad
  wireless: `
    <svg class="port-icon-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="14" cy="14" r="3.5" fill="currentColor"/>
      <circle cx="14" cy="14" r="7.5" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2"/>
      <circle cx="14" cy="14" r="11" stroke="currentColor" stroke-width="2"/>
    </svg>
  `,

  // Figma chevron indicator
  chevron: `
    <svg class="port-chevron-svg" viewBox="0 0 16 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2L13 14L3 26" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // Success checkmark
  checkmark: `
    <svg class="status-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M7 12.5L10.5 16L17 8.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // Bolt / Power indicator
  bolt: `
    <svg class="status-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="currentColor"/>
    </svg>
  `,

  // Close / Dismiss
  close: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
};

/**
 * Returns icon SVG markup for a given port type.
 * @param {string} type 
 * @returns {string} SVG HTML string
 */
export function getPortIcon(type) {
  return ICONS[type] || ICONS.outlet;
}
