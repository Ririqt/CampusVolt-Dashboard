import {
  PORT_ID_SET,
  REDIS_TOKEN,
  REDIS_URL,
  STATION_ID,
  configurationError,
  jsonResponse,
  portKey,
  readSharedState,
  redis,
} from "./_campusvolt-redis.mjs";

export async function GET() {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();
  try {
    const { sessions, station } = await readSharedState();
    return jsonResponse(200, { stationId: STATION_ID, sessions, station });
  } catch (error) {
    console.error("Unable to read CampusVolt channel state", error);
    return jsonResponse(502, { error: "Shared channel state is temporarily unavailable." });
  }
}

export async function POST(request) {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { error: "A JSON request body is required." });
  }

  const portId = String(input.portId || "");
  const durationMinutes = Number(input.durationMinutes);
  if (!PORT_ID_SET.has(portId) || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
    return jsonResponse(400, { error: "Invalid channel or charging duration." });
  }

  try {
    const current = await readSharedState();
    if (current.station.online && (current.station.channels[portId]?.inUse || current.station.channels[portId]?.fault)) {
      return jsonResponse(409, {
        error: current.station.channels[portId]?.fault
          ? "Station sensors report a fault on this channel."
          : "Station sensors report that this channel is already in use.",
        sessions: current.sessions,
        station: current.station,
      });
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

    // Atomic web reservation: exactly one visitor can claim a channel.
    const reserved = await redis([
      "SET",
      portKey(portId),
      JSON.stringify(session),
      "NX",
      "PX",
      durationMs,
    ]);
    if (reserved !== "OK") {
      const latest = await readSharedState();
      return jsonResponse(409, {
        error: "That channel is already in use.",
        sessions: latest.sessions,
        station: latest.station,
      });
    }
    return jsonResponse(201, { stationId: STATION_ID, session });
  } catch (error) {
    console.error("Unable to reserve CampusVolt channel", error);
    return jsonResponse(502, { error: "The channel could not be reserved. Please try again." });
  }
}

export async function DELETE(request) {
  if (!REDIS_URL || !REDIS_TOKEN) return configurationError();

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { error: "A JSON request body is required." });
  }

  const portId = String(input.portId || "");
  if (!PORT_ID_SET.has(portId)) return jsonResponse(404, { error: "Channel not found." });

  try {
    await redis(["DEL", portKey(portId)]);
    return jsonResponse(200, { stationId: STATION_ID, released: portId });
  } catch (error) {
    console.error("Unable to release CampusVolt channel", error);
    return jsonResponse(502, { error: "The channel could not be released. Please try again." });
  }
}
