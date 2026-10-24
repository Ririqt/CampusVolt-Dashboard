const PORT_IDS = new Set([
  "outlet-1",
  "outlet-2",
  "dc-type-c",
  "dc-micro-usb",
  "dc-lightning",
  "wireless-pad",
]);

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const STATION_ID = String(process.env.CAMPUSVOLT_STATION_ID || "station-01")
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "-")
  .slice(0, 48);

function response(status, payload) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function portKey(portId) {
  return `campusvolt:${STATION_ID}:channel:${portId}`;
}

function configurationError() {
  return response(503, {
    error: "Shared channel storage is not configured. Connect Upstash Redis to this Vercel project and redeploy.",
  });
}

async function redis(command) {
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

async function listSessions() {
  const values = await redis(["MGET", ...Array.from(PORT_IDS, portKey)]);
  return (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map((value) => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function GET() {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();
  try {
    return response(200, { stationId: STATION_ID, sessions: await listSessions() });
  } catch (error) {
    console.error("Unable to read CampusVolt channel state", error);
    return response(502, { error: "Shared channel state is temporarily unavailable." });
  }
}

export async function POST(request) {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();

  let input;
  try {
    input = await request.json();
  } catch {
    return response(400, { error: "A JSON request body is required." });
  }

  const portId = String(input.portId || "");
  const durationMinutes = Number(input.durationMinutes);
  if (!PORT_IDS.has(portId) || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
    return response(400, { error: "Invalid channel or charging duration." });
  }

  const now = Date.now();
  const durationMs = durationMinutes * 60_000;
  const session = {
    portId,
    portName: String(input.portName || portId).slice(0, 80),
    portType: String(input.portType || "outlet").slice(0, 40),
    spec: String(input.spec || "").slice(0, 200),
    device: String(input.device || "Phone").slice(0, 80),
    watts: portId === "wireless-pad" ? 10 : 9,
    paid: `PHP ${durationMinutes} - ${String(input.method || "Cash").slice(0, 20)}`,
    durationMinutes,
    totalSeconds: durationMinutes * 60,
    remainingSeconds: durationMinutes * 60,
    cost: durationMinutes,
    startTime: now,
    endTime: now + durationMs,
    energyKWh: 0,
  };

  try {
    // Atomic reservation: exactly one visitor can claim a channel.
    const reserved = await redis([
      "SET",
      portKey(portId),
      JSON.stringify(session),
      "NX",
      "PX",
      durationMs,
    ]);
    if (reserved !== "OK") {
      return response(409, {
        error: "That channel is already in use.",
        sessions: await listSessions(),
      });
    }
    return response(201, { stationId: STATION_ID, session });
  } catch (error) {
    console.error("Unable to reserve CampusVolt channel", error);
    return response(502, { error: "The channel could not be reserved. Please try again." });
  }
}

export async function DELETE(request) {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();

  let input;
  try {
    input = await request.json();
  } catch {
    return response(400, { error: "A JSON request body is required." });
  }

  const portId = String(input.portId || "");
  if (!PORT_IDS.has(portId)) return response(404, { error: "Channel not found." });

  try {
    await redis(["DEL", portKey(portId)]);
    return response(200, { stationId: STATION_ID, released: portId });
  } catch (error) {
    console.error("Unable to release CampusVolt channel", error);
    return response(502, { error: "The channel could not be released. Please try again." });
  }
}
