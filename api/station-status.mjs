import { timingSafeEqual } from "node:crypto";
import {
  PORT_IDS,
  REDIS_TOKEN,
  REDIS_URL,
  STATION_ID,
  configurationError,
  hardwareKey,
  jsonResponse,
  publicHardwareState,
  redis,
} from "./_campusvolt-redis.mjs";

const STATION_API_KEY = process.env.CAMPUSVOLT_STATION_API_KEY || "";
const HEARTBEAT_TTL_SECONDS = 30;

function isAuthorized(request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supplied = request.headers.get("x-campusvolt-key") || bearer;
  if (!STATION_API_KEY || !supplied) return false;
  const expectedBuffer = Buffer.from(STATION_API_KEY);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function boundedNumber(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(minimum, number));
}

function normalizeChannel(source) {
  const watts = boundedNumber(source?.watts, 0, 500);
  return {
    inUse: typeof source?.inUse === "boolean" ? source.inUse : watts >= 1,
    watts,
    voltageV: boundedNumber(source?.voltageV, 0, 300),
    currentA: boundedNumber(source?.currentA, 0, 20),
    relayOn: Boolean(source?.relayOn),
    fault: source?.fault ? String(source.fault).slice(0, 80) : null,
  };
}

export async function POST(request) {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();
  if (!STATION_API_KEY) {
    return jsonResponse(503, { error: "CAMPUSVOLT_STATION_API_KEY is not configured." });
  }
  if (!isAuthorized(request)) return jsonResponse(401, { error: "Invalid station credentials." });

  const contentLength = Number(request.headers.get("content-length")) || 0;
  if (contentLength > 16_384) return jsonResponse(413, { error: "Station payload is too large." });

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { error: "A JSON request body is required." });
  }

  if (input.stationId && String(input.stationId) !== STATION_ID) {
    return jsonResponse(409, { error: `This endpoint is configured for ${STATION_ID}.` });
  }

  const channels = {};
  for (const portId of PORT_IDS) {
    channels[portId] = normalizeChannel(input.channels?.[portId]);
  }

  const hardware = {
    stationId: STATION_ID,
    updatedAt: Date.now(),
    firmwareVersion: String(input.firmwareVersion || "unknown").slice(0, 40),
    rssi: Number.isFinite(Number(input.rssi)) ? boundedNumber(input.rssi, -120, 0) : null,
    channels,
  };

  try {
    await redis([
      "SET",
      hardwareKey(),
      JSON.stringify(hardware),
      "EX",
      HEARTBEAT_TTL_SECONDS,
    ]);
    return jsonResponse(202, {
      accepted: true,
      heartbeatTtlSeconds: HEARTBEAT_TTL_SECONDS,
      station: publicHardwareState(hardware),
    });
  } catch (error) {
    console.error("Unable to save CampusVolt hardware heartbeat", error);
    return jsonResponse(502, { error: "Station telemetry could not be saved." });
  }
}
