export const PORT_IDS = [
  "outlet-1",
  "outlet-2",
  "dc-type-c",
  "dc-micro-usb",
  "dc-lightning",
  "wireless-pad",
];

export const PORT_ID_SET = new Set(PORT_IDS);
export const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
export const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const STATION_ID = String(process.env.CAMPUSVOLT_STATION_ID || "station-01")
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "-")
  .slice(0, 48);

const HARDWARE_TTL_MS = 30_000;

export function jsonResponse(status, payload) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export function configurationError() {
  return jsonResponse(503, {
    error: "Shared channel storage is not configured. Connect Upstash Redis to this Vercel project and redeploy.",
  });
}

export function portKey(portId) {
  return `campusvolt:${STATION_ID}:channel:${portId}`;
}

export function hardwareKey() {
  return `campusvolt:${STATION_ID}:hardware`;
}

export async function redis(command) {
  const result = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const payload = await result.json();
  if (!result.ok || payload.error) {
    throw new Error(payload.error || `Redis returned HTTP ${result.status}`);
  }
  return payload.result;
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function publicHardwareState(value) {
  const hardware = typeof value === "string" ? parseJson(value) : value;
  const updatedAt = Number(hardware?.updatedAt) || 0;
  const online = Boolean(updatedAt && Date.now() - updatedAt <= HARDWARE_TTL_MS);
  const channels = {};

  for (const portId of PORT_IDS) {
    const source = online && hardware?.channels && typeof hardware.channels[portId] === "object"
      ? hardware.channels[portId]
      : {};
    channels[portId] = {
      inUse: Boolean(source.inUse),
      watts: Math.max(0, Number(source.watts) || 0),
      voltageV: Math.max(0, Number(source.voltageV) || 0),
      currentA: Math.max(0, Number(source.currentA) || 0),
      relayOn: Boolean(source.relayOn),
      fault: source.fault ? String(source.fault).slice(0, 80) : null,
    };
  }

  return {
    online,
    stationId: STATION_ID,
    updatedAt: online ? updatedAt : null,
    firmwareVersion: online ? String(hardware?.firmwareVersion || "unknown").slice(0, 40) : null,
    rssi: online && hardware?.rssi !== null && hardware?.rssi !== undefined && Number.isFinite(Number(hardware.rssi))
      ? Number(hardware.rssi)
      : null,
    channels,
  };
}

export async function readSharedState() {
  const values = await redis([
    "MGET",
    ...PORT_IDS.map(portKey),
    hardwareKey(),
  ]);
  const rows = Array.isArray(values) ? values : [];
  const sessions = rows
    .slice(0, PORT_IDS.length)
    .map(parseJson)
    .filter(Boolean);
  const station = publicHardwareState(rows[PORT_IDS.length]);
  return { sessions, station };
}
