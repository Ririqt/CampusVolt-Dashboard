# ESP32 station integration

The deployed dashboard is ready to receive physical channel occupancy and
electrical readings from CampusVolt Station 01. The ESP32 makes an outbound
HTTPS request, so no inbound port, static public IP, or router port-forwarding
is required.

## Vercel configuration

Create a long random secret and add it to the Vercel project as a Production
and Preview environment variable:

```text
CAMPUSVOLT_STATION_API_KEY=<at least 32 random characters>
```

Configure the same value in the ESP32 firmware. It must never be included in
browser JavaScript or committed to Git. Redeploy Vercel after adding it.

`CAMPUSVOLT_STATION_ID` is optional and defaults to `station-01`.

## Heartbeat request

The ESP32 must POST a complete snapshot on every sensor-state change and at
least once every 10 seconds:

```http
POST https://campusvolt-v3.vercel.app/api/station-status
Authorization: Bearer <CAMPUSVOLT_STATION_API_KEY>
Content-Type: application/json
```

```json
{
  "stationId": "station-01",
  "firmwareVersion": "1.0.0",
  "rssi": -58,
  "channels": {
    "outlet-1":     { "inUse": true,  "watts": 42.1, "voltageV": 221.4, "currentA": 0.19, "relayOn": true },
    "outlet-2":     { "inUse": false, "watts": 0,    "voltageV": 221.2, "currentA": 0,    "relayOn": true },
    "dc-type-c":    { "inUse": false, "watts": 0,    "voltageV": 5.1,   "currentA": 0,    "relayOn": true },
    "dc-micro-usb": { "inUse": false, "watts": 0,    "voltageV": 5.1,   "currentA": 0,    "relayOn": true },
    "dc-lightning": { "inUse": false, "watts": 0,    "voltageV": 5.1,   "currentA": 0,    "relayOn": true },
    "wireless-pad": { "inUse": false, "watts": 0,    "voltageV": 5.1,   "currentA": 0,    "relayOn": true }
  }
}
```

The endpoint accepts either the `Authorization: Bearer` header above or an
`X-CampusVolt-Key` header. A successful request returns HTTP `202`.

## Required behavior

- Send all six channel IDs in every heartbeat.
- Derive `inUse` from a calibrated current/power threshold with hysteresis so
  sensor noise does not rapidly toggle the dashboard.
- Report `fault` when a sensor, relay, over-current, or over-temperature fault
  occurs. Otherwise omit it or send `null`.
- Use HTTPS certificate validation in production firmware.
- Retry transient failures with a bounded backoff, while continuing local
  over-current and relay safety independently of the cloud.
- Never wait for Vercel before applying a local electrical safety shutdown.

The Redis hardware record expires 30 seconds after the last accepted
heartbeat. When it expires, dashboards mark the station offline and stop using
the old readings. Website reservations remain separate from physical sensor
occupancy; a channel is shown as in use when either source says it is active.

## Sensor adapter boundary

The firmware must produce these normalized values for each channel:

```cpp
struct ChannelReading {
  bool inUse;
  float watts;
  float voltageV;
  float currentA;
  bool relayOn;
  const char* fault;
};
```

Use the PZEM-004T adapter for the two AC outlets and the chosen calibrated DC
voltage/current sensor adapters for Type-C, Micro USB, Lightning, and wireless.
The exact ESP32 pins, UART addresses, I2C addresses, and thresholds must match
the final schematic and cannot safely be inferred by the web application.

## Pre-hardware test

Use `scripts/send-station-heartbeat.ps1` to exercise the complete cloud and UI
path before connecting the ESP32.
