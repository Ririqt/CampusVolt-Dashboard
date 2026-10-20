# CampusVolt Dashboard

CampusVolt is the web interface for a proposed solar-powered campus charging kiosk. This repository currently provides a complete browser-based demonstration of the user flow, charging sessions, battery/solar telemetry, energy-management decisions, research logging, accessibility settings, and team information.

The dashboard is usable without the physical ESP32. Battery, solar, BMS, output-sensor, payment, Wi-Fi access-point, and relay behavior are currently simulated unless this document explicitly says otherwise.

## Running the program

This is a static HTML, CSS, and JavaScript project. It should be served through HTTP because it uses JavaScript modules.

From the project directory, run:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The root page redirects to the Dashboard. The main pages can also be opened directly:

- Dashboard: `http://localhost:8000/html/dashboard.html`
- Information: `http://localhost:8000/html/information.html`
- Settings: `http://localhost:8000/html/settings.html`
- Team: `http://localhost:8000/html/team.html`
- Telemetry Simulator: `http://localhost:8000/html/simulator.html`

## Program status

### Implemented in the browser

- Six interactive charging channels
- Cash and GCash demonstration flows
- Charging-session timers and early stopping
- Daily connected-device and delivered-energy counters
- Battery, solar, weather, load, and output telemetry displays
- Normal, Conservation, and Survival Eco decisions
- Safety overrides and charging-access restrictions
- Predefined hardware-independent test scenarios
- Telemetry history chart and CSV export
- Cross-page and cross-tab synchronization
- English and Filipino interface text
- Display brightness and text-size preferences
- Information, CV, contact, and charging dialogs

### Still simulated or pending hardware integration

- ESP32 connection and firmware
- `CampusVolt-AP` Wi-Fi access point
- Gentai BMS Bluetooth data
- PZEM-004T AC measurements
- DC voltage/current sensor measurements
- Physical relay switching
- Real coin acceptor and GCash verification
- Cloud synchronization
- Sound and low-battery alert output
- Trained Edge-ML ANN inference

## Tabs and pages

### Dashboard

The Dashboard is the primary charging interface.

The station-status strip shows:

- Current telemetry source
- Energy-management mode and reason
- Battery State of Charge (SoC)
- Solar generation
- Mode-decision load input
- Weather forecast input
- Simulated message latency

The charging area contains six channels:

- Two 220 V AC outlets
- One USB Type-C cable
- One Micro USB cable
- One Lightning cable
- One wireless charging pad

Each card can have one of these states:

- **Available:** the user may begin the charging flow.
- **In use:** a valid active session and countdown timer exist.
- **Energy disabled:** the current energy policy or safety state prevents a new session.

An `in-use` state is valid only while the port has a matching unexpired session. Expired or orphaned states are automatically repaired to `available`.

### Information

The Information page explains the station and displays detailed telemetry.

#### Battery Bank card

Select the card to open a detailed dialog containing:

- SoC and operating status
- Rated and remaining energy
- Pack voltage, current, and power
- Temperature and State of Health
- Cell balance
- Protection state
- Last-update freshness

These values currently come from the shared telemetry simulator. They are structured so a Gentai BMS/ESP32 adapter can replace the simulation later.

#### Solar Energy Harvest card

Select the card to view panel output, energy generated today, peak capacity, system voltage, charge-controller state, and utilization.

#### Weather Forecast card

This card retrieves current conditions from Open-Meteo for the configured PUP CEA coordinates. It caches the latest valid response for temporary API failures.

Important: the visible weather card uses live Open-Meteo data, while the rule-based energy controller currently uses the forecast selected in the Simulator. These sources should be joined when the ESP32/API integration is implemented.

#### Charging Output Telemetry

This section uses active charging sessions as its input:

- Outlet sessions contribute to AC load.
- Type-C, Micro USB, Lightning, and wireless sessions contribute to DC load.
- Total delivered load is the sum of AC and DC session power.
- AC and DC current are calculated using `current = power / voltage`.
- Regulated voltage and a small load variation are simulated so the values update visibly.
- When a group has no active session, its voltage, current, and load display zero.

The physical version will replace these calculations with PZEM-004T and DC sensor readings.
The panel remains visible when Demonstration Mode is off so the same area can display ESP32 sensor readings in the standard interface.

#### Daily summary counters

- **Devices connected today** increases when a charging session starts.
- **Energy delivered today** is calculated from session power and elapsed charging time.
- **Ports currently active** is the number of valid active sessions out of six.

The daily counters persist in the browser and reset at local midnight. One charging session is counted as one device connection; the software cannot yet recognize whether the same physical device reconnects multiple times.

### Settings

The Settings page contains:

- Screen brightness: Auto, 100%, or 60%
- Text-size slider
- English/Filipino language selection
- Confirmation-sound toggle
- Low-battery-alert toggle
- `CampusVolt-AP` connectivity row
- Cloud-sync toggle
- Link to the telemetry simulator
- Report Issue and About actions

Text size, brightness, language, and the Demonstration Mode switch are functional and stored locally. The action buttons show demonstration toasts. `CampusVolt-AP`, cloud sync, issue dispatch, sound output, and alert output are placeholders until their hardware or backend services are implemented.

#### Demonstration Mode switch

Demonstration Mode is enabled by default.

When it is **On**:

- Simulated station telemetry and the policy status strip are visible.
- The Charging Output Telemetry panel labels its values as live session simulation.
- Rule-based mode limits can restrict new charging sessions.
- The Simulator link and controls are available.

When it is **Off**:

- Demo-only station telemetry banners are hidden.
- The Charging Output Telemetry panel remains visible as part of the standard interface.
- Charging ports remain usable without simulated policy restrictions.
- The Simulator shortcut is hidden and direct Simulator controls are disabled.
- The navigation connection label changes to `Local interface`.
- Charging sessions, payment dialogs, timers, daily counters, Information content, Settings, and Team features remain usable.

Turning Demo Mode off does not delete saved simulator data or active charging sessions. Enabling it again restores the current saved demonstration state.

`CampusVolt-AP` is intended to be the ESP32-created local Wi-Fi network. It does not represent a real access point in the current version.

### Team

The Team page presents the four project members, project milestones, contact links, and a contact form.

- Selecting a member card opens a CV dialog.
- Email and LinkedIn buttons open the corresponding external actions.
- “Say hello” opens a contact dialog.
- Submitting the contact form creates a `mailto:` message for `campusvolts@gmail.com`; it does not send through a server.

### Telemetry Simulator

The Simulator controls the shared station telemetry before an ESP32 is available.

It provides scenarios for:

- Sunny charging
- Cloudy operation
- Evening discharge
- Low battery
- Critical battery cutoff
- High temperature
- BMS disconnection

Manual controls adjust solar generation, charging-load demand, forecast input, and simulation speed. Start advances battery energy over time, Pause stops time advancement, and Reset restores the demonstration state and clears telemetry history.

The history chart plots recent SoC, solar power, and load. CSV export includes message IDs, timestamps, latency, scenario, forecast, battery/output measurements, selected and expected modes, decision match, and safety state.

## Interactive dialogs and pop-ups

### Charging flow

Selecting an available port opens a four-stage dialog:

1. **Pay:** choose Cash or GCash and select a duration. The price is `₱1 per minute`.
2. **Confirm:** review the port, payment method, duration, and total.
3. **Connect:** confirm that the device has been connected.
4. **Charging:** view the remaining time, progress, device, simulated power, payment, and port.

The payment screens are demonstrations. No coins are read and no GCash transaction is verified.

Inside the active-session dialog:

- **Done** closes the dialog but leaves the session running.
- **Stop charging early** ends the session and makes the port available.
- Closing the dialog also leaves the session running.
- When the timer reaches zero, the session ends automatically.

Selecting an in-use port reopens its active-session dialog.

### Energy-policy warning

If a new port would violate the current mode limit, the Dashboard prevents the charging dialog from opening and displays the policy reason in a toast.

### Information details

Selecting the Battery, Solar, or Weather card opens a detailed telemetry dialog. It can be closed with its close button, the Escape key, or by selecting the backdrop.

### Team CV and contact dialogs

Selecting a team-member card opens that member's complete CV. The contact dialog creates an email using the visitor's default email application.

### Settings feedback

Settings actions display short status toasts. Connectivity and support messages are simulated feedback, not confirmation from an ESP32 or backend.

## Energy-management logic

The current controller is a deterministic **rule-based demonstration baseline**, not the final ANN.

Rules are evaluated in this order:

### 1. Survival Eco Mode

Activated when any of these is true:

- SoC is below 25%
- Forecast is weak (`Low` or `None`) while SoC is below 30%

Maximum permitted station load: **60 W**.

In this mode, both AC outlets are unavailable. Type-C, Micro USB, Lightning, and wireless charging remain available with reduced DC power allowances, provided no safety override is active.

### 2. Conservation Mode

Activated when:

- SoC is below 50% **and** the forecast is `Low` or `None`
- A requested station load exceeds 250 W while SoC is below 60% and solar generation is below the requested load plus a 30 W reserve margin

Maximum permitted station load: **150 W**.

Survival Eco has priority when conditions overlap.

The rapid-discharge condition is latched. Once triggered, Conservation Mode remains active even if demand falls below 250 W. The latch clears only after active solar charging replenishes the battery to at least 65% SoC. This 60% trigger and 65% release hysteresis prevents repeated relay switching near the threshold. Safety overrides and Survival Eco continue to take priority while the latch is stored in shared telemetry state.

### 3. Normal Mode

Used when neither Survival Eco nor Conservation is triggered.

Maximum permitted station load: **456 W**.

For example, 76% SoC with a Low forecast and a 9 W load remains in Normal Mode.

### Safety overrides

Safety is separate from the three operating modes. New charging sessions are blocked when:

- BMS telemetry is disconnected
- Battery protection is not `normal`
- Battery temperature is 55°C or higher
- Battery SoC is below the strict 10% cutoff

Safety overrides set the permitted load to zero while monitoring remains available.

### Port-admission calculation

Before opening a new session, the controller checks:

```text
active session load + requested port allowance <= current mode limit
```

Requested allowances are:

| Port type      | Allowance |
|----------------|-----------|
| AC outlet      | 150 W     |
| USB Type-C     | 65 W      |
| Micro USB      | 12 W      |
| Lightning      | 20 W      |
| Wireless       | 15 W      |

This is intentionally conservative: the admission check reserves the port's possible demand, while the live session telemetry displays the current simulated draw.

Survival Eco is an exception to the normal rated-power reservation: AC outlets are paused and reduced allowances of 20 W Type-C, 8 W Micro USB, 12 W Lightning, and 8 W wireless keep all DC charging types eligible within the 60 W station limit.

## Telemetry and synchronization

Telemetry is shared among pages through `localStorage` and `BroadcastChannel`.

The telemetry snapshot contains:

- Battery measurements and estimates
- Solar generation and energy
- Demand and output load
- AC/DC output estimates
- Weather forecast input
- Selected operating mode and safety state
- BMS/connection state
- Message sequence, ID, sent/received timestamps, and latency

The simulator recalculates battery energy using solar power, load, elapsed simulated time, charge efficiency, and inverter efficiency. It also estimates charging time or remaining runtime.

The shared policy is recalculated whenever saved telemetry is loaded or changed. This prevents an older stored Conservation decision from disabling ports after the rules have changed.

## Browser data

The program currently stores its state only in the browser. Important keys include:

| Key                               | Purpose                                |
|-----------------------------------|----------------------------------------|
| `cv_station_telemetry_v1`         | Latest station telemetry snapshot      |
| `cv_station_telemetry_history_v1` | Recent simulator history               |
| `cv_charging_sessions`            | Active charging sessions and timers    |
| `cv_ports_status`                 | Saved port statuses                    |
| `cv_charging_stats`               | Current day's device and energy totals |
| `campusvolt-weather-v1`           | Cached Open-Meteo response             |
| `cv_font_scale`                   | Text-size preference                   |
| `cv_brightness`                   | Brightness preference                  |
| `cv_language`                     | English/Filipino preference            |
| `cv_demo_mode`                    | Demonstration Mode on/off state         |

Clearing browser site data resets the saved demonstration state.

## Main source files

```text
index.html                         Root redirect
html/dashboard.html               Charging interface
html/information.html             Telemetry and system explanation
html/settings.html                Kiosk preferences and demo tools
html/team.html                    Team profiles and contact interface
html/simulator.html               Hardware-independent simulator

js/campusvolt-dashboard.js        Dashboard telemetry display
js/campusvolt-telemetry.js        Information telemetry and weather
js/simulator-page.js              Simulator UI and CSV export
js/team-cv.js                     Team CV dialogs
js/team-contact.js                Contact mailto flow

js/modules/energy-policy.js       Shared mode and safety decisions
js/modules/telemetry-store.js     Telemetry persistence and broadcasting
js/modules/telemetry-simulator.js Battery/solar/load simulation
js/modules/ports-state.js         Sessions, timers, daily totals, persistence
js/modules/charging-controller.js Port access and UI coordination
js/modules/charging-modal.js      Payment and charging dialogs
js/modules/ports-renderer.js      Charging-card rendering
js/modules/ports-config.js        Port and pricing configuration
js/modules/kiosk-preferences.js   Display preferences
js/modules/i18n.js                English and Filipino text
```

## Connecting the real ESP32 later

The browser demonstration does not automatically communicate with an ESP32. Integration still requires:

1. ESP32 firmware that reads the BMS and electrical sensors.
2. A local HTTP/WebSocket API with an agreed telemetry schema.
3. Optional ESP32 SoftAP setup for `CampusVolt-AP`.
4. A dashboard transport adapter that replaces simulator updates with ESP32 messages.
5. Relay-command acknowledgements and fail-safe handling.
6. Real sent, received, and displayed timestamps for latency testing.
7. Authentication and input validation for control commands.
8. Cached/fallback behavior when Wi-Fi, the internet, weather service, or BMS becomes unavailable.

A practical final architecture is:

```text
Gentai BMS / sensors
        ↓
      ESP32
        ↓  local HTTP or WebSocket
Telemetry store
        ↓
Dashboard + Information + logging
```

The Gentai BMS can be the operational battery-data source, while a calibrated shunt or meter should be retained as the experimental reference for SoC and energy-accuracy testing.

## Important limitations

- Dashboard values are not physical measurements yet.
- Simulated GCash confirmation is not payment-provider verification.
- The weather API is live, but its result is not yet the automatic control input.
- `CampusVolt-AP` and cloud synchronization are UI placeholders.
- Local browser storage is not a multi-device database.
- Daily device totals count sessions, not unique device identities.
- The rule-based baseline should not be reported as ANN accuracy.
- Physical electrical safety and efficiency must be verified using the completed hardware and calibrated instruments.

## Related documentation

See `PAPER_REVIEW.md` for manuscript inconsistencies, recommended corrections, research-method notes, and the software alignment already completed.
