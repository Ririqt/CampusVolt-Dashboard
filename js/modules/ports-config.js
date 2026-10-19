/**
 * CampusVolt Dashboard - Charging Ports Configuration (Figma Specification)
 * Matches the exact hardware setup in the new Figma version:
 * 1. Outlets (2 ports: Outlet 1, Outlet 2)
 * 2. DC cables (3 ports: Type-C, Micro USB, Lightning)
 * 3. Wireless (1 port: Wireless pad)
 * Total: 6 ports (3 active, 3 available)
 */

export const PRICING_CONFIG = {
  ratePerMinute: 1.0, // ₱1 per minute
  currencySymbol: "₱",
  currencyCode: "PHP",
  presetDurations: [15, 30, 45, 60], // in minutes
  defaultDuration: 30,
  minDuration: 5,
  maxDuration: 120,
  stepMinutes: 5,
};

export const PORT_CATEGORIES = [
  {
    id: "outlets",
    title: "Outlets",
    description: "220V AC Power Sockets",
    ports: [
      {
        id: "outlet-1",
        name: "Outlet 1",
        type: "outlet",
        spec: "220V AC • Universal Socket (Max 150W)",
        initialStatus: "available",
      },
      {
        id: "outlet-2",
        name: "Outlet 2",
        type: "outlet",
        spec: "220V AC • Universal Socket (Max 150W)",
        initialStatus: "available",
      },
    ],
  },
  {
    id: "dc-cables",
    title: "DC cables",
    description: "Tethered Fast-Charging Cables",
    ports: [
      {
        id: "dc-type-c",
        name: "Type-C",
        type: "type-c",
        spec: "Power Delivery 3.0 • Up to 65W Fast Charge",
        initialStatus: "available",
      },
      {
        id: "dc-micro-usb",
        name: "Micro USB",
        type: "micro-usb",
        spec: "Quick Charge 2.0 • 5V 2.4A (12W)",
        initialStatus: "available",
      },
      {
        id: "dc-lightning",
        name: "Lightning",
        type: "lightning",
        spec: "Apple MFi Fast Charge • 20W PD",
        initialStatus: "available",
      },
    ],
  },
  {
    id: "wireless",
    title: "Wireless",
    description: "Inductive Qi Charging Station",
    ports: [
      {
        id: "wireless-pad",
        name: "Wireless pad",
        type: "wireless",
        spec: "Qi Certified Fast Wireless • 15W Max",
        initialStatus: "available",
      },
    ],
  },
];
