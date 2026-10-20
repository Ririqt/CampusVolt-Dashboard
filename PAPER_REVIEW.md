# CampusVolt paper review

Reviewed against `MAIN PAPER_DP 1 (6).pdf` and the current pre-hardware dashboard demo.

## Changes to make in the manuscript

### High priority: internal consistency

1. **Use four research questions throughout.** The Statement of the Problem contains four main questions (PDF pp. 27–28), but the methodology says “five research questions” (PDF p. 85). Change that sentence to “four research questions.”
2. **Correct the technical-metric question numbers.** The metrics on PDF pp. 96–98 refer to Research Questions 5.1, 5.2, and SOP 5.3. These should be 3.1, 3.2, and 3.3, respectively. The telemetry metric already points to 3.4.
3. **Standardize the questionnaire as a four-point scale.** PDF pp. 86–87 and p. 131 call it a five-point scale, but only four scored choices are listed, and Table 1 on PDF p. 93 is explicitly four-point. Replace “five-point” with “four-point” unless a fifth scored response will actually be added. Keep “Not Observed/Not Applicable” separate and non-scored. Also remove the extra parenthesis in `1 ((Strongly Disagree)`.
4. **Standardize the panel rating at 450 W.** The design, component list, and calculations mostly use a 450 W monocrystalline panel, but the harvesting-efficiency description on PDF p. 96 says 440 W.
5. **Fix the Definition of Terms entries.** On PDF p. 35, “Internet of Things (IoT)” and “ISO/IEC 25010” both use descriptions of the embedded controller. Define IoT as the network of sensors/controllers/interfaces exchanging telemetry, and define ISO/IEC 25010 as the software product-quality model used for evaluation.
6. **Align the ANN definition with the actual study.** PDF p. 34 says the ANN classifies connected devices, while the scope and testing protocol use it to select Normal, Conservation, or Survival Eco mode. Device classification should be removed unless it is genuinely implemented and evaluated.

### High priority: method clarity

7. **Clarify the ANN boundary.** The documented ANN inputs are battery SoC, measured load demand, and weather forecast; its output is an operating mode. The Python/Jupyter description on PDF p. 126 also claims solar forecasting and demand estimation. Either define and evaluate those additional model outputs, or limit that description to training and validating the operating-mode classifier.
8. **Correct the MAPE variable definitions.** The SoC MAPE section on PDF p. 96 defines “Actual” and “Predicted” as energy generation or charging-demand values. They should be reference SoC from a calibrated instrument and ESP32/BMS-estimated SoC. State how zero or near-zero reference values will be handled.
9. **Document the real battery-data source.** The paper currently specifies an external shunt/INA219 path. If the Gentai BMS Bluetooth interface will supply SoC, voltage, current, temperature, protection state, cell voltages, cycle count, and remaining capacity, revise the block diagram, bill of materials, data flow, and validation method. A defensible setup is: Gentai BMS as the operational source, calibrated shunt/meter as the experimental reference.
10. **Separate operating mode from safety state.** Normal, Conservation, and Survival Eco are the three ANN outputs. Over-temperature, BMS disconnect, overload, and SoC below 10% are deterministic safety overrides, not extra ANN modes.
11. **Describe weather fallback behavior precisely.** State the forecast provider, update interval, cached-data maximum age, behavior when no cached forecast exists, and whether the controller falls back to a conservative mode.
12. **Define telemetry evidence fields.** For the transmission-success and latency tests, log message ID, source timestamp, received timestamp, displayed timestamp, delivery result, and dashboard target. This makes the under-one-second latency and packet-loss claims measurable.

### Before final defense

13. Label dashboard payments and telemetry as **simulated** until GCash and ESP32 integrations are operational. Do not present a typed reference number as payment-provider verification.
14. State that the current pre-hardware policy is a **rule-based baseline**, not the trained ANN. Later compare ANN decisions against the same expected-mode scenario set.
15. Keep the maximums consistent in requirements and tests: 150 W per AC channel, approximately 456 W total station load, and a strict charging-output cutoff below 10% SoC.
16. Add a traceability table mapping each SOP sub-question to its instrument, variables, test cases, metric, acceptance threshold, and evidence file.

## Software alignment completed

- Added the three paper-defined modes: Normal, Conservation, and Survival Eco.
- Added independent safety states for BMS disconnect, battery protection, and the below-10% cutoff.
- Added SoC, load demand, and weather forecast as the decision inputs.
- Added seven repeatable demonstration scenarios, including critical battery and disconnected BMS cases.
- Added message IDs, transmission/receipt timestamps, simulated latency, expected-mode comparison, and CSV research export.
- Added paper-aligned 150 W restricted mode and 456 W maximum-load enforcement.
- Exposed battery capacity, remaining energy, SoC, voltage, current, power, temperature, health, cycle count, cells, protection state, latency, source, and freshness on the Information page.

The simulator is evidence for interface and control-flow demonstrations only. It does not establish physical efficiency, electrical safety, BMS accuracy, real packet-loss performance, or ANN accuracy; those require the completed hardware and experimental protocol.
