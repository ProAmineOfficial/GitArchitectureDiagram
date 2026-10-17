// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: Board support profiles (gad.board/1) and a deterministic pin check,
// as pure functions (no DOM, no network), so the browser and the Node tests share them.
//
// The checks encode published ESP32 and NanoKit documentation only: input-only pins, flash-reserved pins, strapping and
// boot pins, the USB-serial UART, ADC2 with Wi-Fi, DAC pins, and 3.3 V logic. They read capability flags from the board
// profile, so another board is another profile, not new code. A passing check means the documented rules found no
// problem; it is never an electrical verification of a circuit. Proprietary allocation strategies belong in the
// private engine, not here.

export const BOARD_SCHEMA = 'gad.board/1';

/** Verdicts, most severe first. */
export const VERDICTS = Object.freeze(['forbidden', 'conflict', 'requires_external_adaptation', 'compatible_with_warning', 'compatible', 'unknown']);
export const VERDICT_LABEL = Object.freeze({
  forbidden: 'Forbidden',
  conflict: 'Conflict',
  requires_external_adaptation: 'Requires external electrical adaptation',
  compatible_with_warning: 'Compatible with warning',
  compatible: 'Compatible',
  unknown: 'Unknown / requires verification',
});
const RANK = Object.freeze({ forbidden: 5, conflict: 4, requires_external_adaptation: 3, compatible_with_warning: 2, compatible: 1, unknown: 0 });

/** What each role asks of a pin: drive it, read it, both (open-drain buses), read it as analog, or output analog. */
const ROLE_KIND = Object.freeze({
  output: 'drive', digital_out: 'drive', led: 'drive', relay: 'drive', trigger: 'drive', pwm: 'drive',
  spi_mosi: 'drive', spi_sclk: 'drive', spi_cs: 'drive', uart_tx: 'drive',
  input: 'read', digital_in: 'read', button: 'read', echo: 'read', spi_miso: 'read', uart_rx: 'read',
  i2c_sda: 'bidirectional', i2c_scl: 'bidirectional',
  adc: 'analog', analog_in: 'analog',
  dac: 'dac',
});
export const ROLES = Object.freeze(Object.keys(ROLE_KIND));
/** Bus lines that several devices may share; a chip-select or a plain GPIO may not be shared. */
const SHAREABLE = new Set(['i2c_sda', 'i2c_scl', 'spi_mosi', 'spi_miso', 'spi_sclk']);
const PIN_TYPES = new Set(['gpio', 'power', 'ground', 'control', 'reference']);
const TYPE_WORD = Object.freeze({ power: 'power pin', ground: 'ground pin', control: 'control line', reference: 'reference pin' });

/** GPIO number from 5, '5', 'GPIO5', or 'gpio5'; NaN when the value is not a GPIO. */
export const gpioNumber = value => Number(typeof value === 'string' ? value.trim().replace(/^gpio/i, '') : value);

/** Shape problems in a board profile; an empty list means the profile is usable. */
export function checkBoardShape(profile) {
  const problems = [];
  if (profile?.schema !== BOARD_SCHEMA) problems.push(`schema must be ${BOARD_SCHEMA}`);
  if (!profile?.id || !profile?.name) problems.push('id and name are required');
  const pins = Array.isArray(profile?.pins) ? profile.pins : [];
  if (!Number.isInteger(profile?.pinCount) || pins.length !== profile.pinCount) problems.push(`pins must list exactly pinCount (${profile?.pinCount}) entries`);
  const numbers = new Set();
  const gpios = new Set();
  for (const pin of pins) {
    if (!PIN_TYPES.has(pin.type)) problems.push(`pin ${pin.pin}: unknown type ${pin.type}`);
    if (!Number.isInteger(pin.pin) || pin.pin < 1 || pin.pin > profile.pinCount) problems.push(`pin ${pin.pin}: number out of range`);
    if (numbers.has(pin.pin)) problems.push(`pin ${pin.pin}: listed twice`);
    numbers.add(pin.pin);
    if (pin.type === 'gpio') {
      if (!Number.isInteger(pin.gpio)) problems.push(`pin ${pin.pin}: gpio must be an integer`);
      else if (gpios.has(pin.gpio)) problems.push(`GPIO${pin.gpio}: mapped to more than one pin`);
      gpios.add(pin.gpio);
    } else if (pin.gpio != null) problems.push(`pin ${pin.pin}: a ${pin.type} pin has no GPIO`);
  }
  return problems;
}

export const pinByNumber = (profile, number) => profile?.pins?.find(pin => pin.pin === Number(number)) || null;
export const pinByGpio = (profile, gpio) => profile?.pins?.find(pin => pin.type === 'gpio' && pin.gpio === gpioNumber(gpio)) || null;
const given = value => value != null && value !== '';
/** A board pin number from a number, a string, or a pin summary ({ pin }) as found on checkWiring rows. */
const boardPinNumber = value => (value && typeof value === 'object' ? value.pin : value);

/** The pin a request names: by board pin number when given, else by GPIO. Accepts checkWiring rows as requests. */
export function locatePin(profile, { pin, gpio } = {}) {
  const number = boardPinNumber(pin);
  if (given(number)) return pinByNumber(profile, number);
  if (given(gpio)) return pinByGpio(profile, gpio);
  return null;
}

const summarize = pin => (pin ? { pin: pin.pin, type: pin.type, gpio: pin.type === 'gpio' ? pin.gpio : null, vr: pin.vr || null, vrAddress: pin.vrAddress || null, label: pin.label || null } : null);
function strappingNote(pin) {
  const level = pin.bootLevel ? ` (expected ${pin.bootLevel})` : '';
  return `GPIO${pin.gpio} is a strapping pin read at power-on${level}; the attached circuit must not force another level during reset.`;
}

/**
 * Check one use of one pin against the documented rules.
 * request: { pin? | gpio?, role, signalVoltage?, targetMinHighVoltage?, targetSupplyVoltage? }
 *   signalVoltage: the highest voltage arriving at the pin (read, analog, and bus roles).
 *   targetMinHighVoltage: the component's minimum input-high voltage, when its datasheet gives one (drive roles).
 *   targetSupplyVoltage: the component's supply, used only to ask for that threshold when it is missing.
 * Returns { verdict, label, reasons[], role, pin }.
 */
export function validatePinUse(profile, request = {}) {
  const role = String(request.role || '');
  const located = locatePin(profile, request);
  const board = profile?.shortName || profile?.name || 'board';
  const finding = (verdict, reasons) => ({ verdict, label: VERDICT_LABEL[verdict], reasons, role, pin: summarize(located) });
  const number = boardPinNumber(request.pin);
  if (!located) return finding('unknown', [`No ${given(number) ? `pin ${number}` : `GPIO${request.gpio}`} on the ${board}.`]);
  if (given(number) && given(request.gpio) && located.gpio !== gpioNumber(request.gpio)) {
    const actual = located.type === 'gpio' ? `GPIO${located.gpio}` : `a ${TYPE_WORD[located.type]}`;
    return finding('conflict', [`Pin ${located.pin} is ${actual}, not GPIO${gpioNumber(request.gpio)}: the board pin number is not the GPIO number.`]);
  }
  if (located.type !== 'gpio') return finding('forbidden', [`Pin ${located.pin} is a ${TYPE_WORD[located.type]} (${located.label}), not a GPIO.`]);
  const gpio = located.gpio;
  if (located.reserved === 'spi-flash') return finding('forbidden', [`GPIO${gpio} (pin ${located.pin}) is connected to the internal SPI flash and must not be used.`]);
  const kind = ROLE_KIND[role];
  if (!kind) return finding('unknown', [`Unknown role "${role}". Known roles: ${ROLES.join(', ')}.`]);

  const blocking = [];
  const adaptation = [];
  const warnings = [];
  if ((kind === 'drive' || kind === 'bidirectional') && located.inputOnly) blocking.push(['forbidden', `GPIO${gpio} is input-only and cannot drive a ${role} signal.`]);
  if (kind === 'dac' && !located.dac) blocking.push(['conflict', `GPIO${gpio} has no DAC; the DAC outputs are GPIO25 (DAC1) and GPIO26 (DAC2).`]);
  if (kind === 'analog') {
    if (!located.adc && !located.adc2) blocking.push(['conflict', `GPIO${gpio} has no ADC channel.`]);
    else if (!located.adc) warnings.push(`${located.adc2} cannot be read while Wi-Fi is active; prefer an ADC1 pin (GPIO32 to GPIO39).`);
  }
  if (located.boot) warnings.push(`GPIO${gpio} is the BOOT pin: it must be high at power-on, and holding it low enters the bootloader.`);
  else if (located.strapping) warnings.push(strappingNote(located));
  if (located.usbSerial) warnings.push(`GPIO${gpio} is UART0, shared with USB serial; using it conflicts with the Serial Monitor. UART2 is on GPIO17 (TX) and GPIO16 (RX).`);

  const logic = Number(profile?.logicVoltage) || 3.3;
  const volts = Number(request.signalVoltage);
  if (kind !== 'drive' && kind !== 'dac' && Number.isFinite(volts) && volts > logic + 0.3 && !profile?.fiveVoltTolerant) {
    adaptation.push(`A ${volts} V signal exceeds the ${logic} V logic of GPIO${gpio}; add a level shifter or a divider before the pin.`);
  }
  if (kind === 'drive') {
    const threshold = Number(request.targetMinHighVoltage);
    const supply = Number(request.targetSupplyVoltage);
    if (Number.isFinite(threshold) && threshold > logic) adaptation.push(`The component needs at least ${threshold} V for a high input, above the ${logic} V output of GPIO${gpio}; add a level shifter.`);
    else if (!Number.isFinite(threshold) && Number.isFinite(supply) && supply > logic) warnings.push(`The component runs at ${supply} V; confirm in its datasheet that a ${logic} V high level is accepted (not verified).`);
  }

  if (blocking.length) {
    const worst = blocking.reduce((top, [verdict]) => (RANK[verdict] > RANK[top] ? verdict : top), 'conflict');
    return finding(worst, [...blocking.map(([, text]) => text), ...adaptation, ...warnings]);
  }
  if (adaptation.length) return finding('requires_external_adaptation', [...adaptation, ...warnings]);
  if (warnings.length) return finding('compatible_with_warning', warnings);
  return finding('compatible', [`GPIO${gpio} (pin ${located.pin}) supports ${role} with no documented restriction.`]);
}

/** The overall verdict of several findings: any blocking verdict, else unknown, else warnings, else compatible. */
export function worstVerdict(verdicts) {
  const list = [...verdicts];
  if (!list.length) return 'unknown';
  const blocking = list.filter(verdict => RANK[verdict] >= RANK.requires_external_adaptation);
  if (blocking.length) return blocking.reduce((top, verdict) => (RANK[verdict] > RANK[top] ? verdict : top));
  if (list.includes('unknown')) return 'unknown';
  return list.includes('compatible_with_warning') ? 'compatible_with_warning' : 'compatible';
}

/**
 * Check a whole wiring plan. connections: [{ name?, component, componentPin?, role, pin? | gpio?, signalVoltage?, ... }]
 * A GPIO used twice is a conflict unless every use is the same shareable bus line (I2C, SPI data and clock).
 * The result is never marked electrically verified: these are documentation rules, not measurements.
 */
export function checkWiring(profile, connections = []) {
  const rows = connections.map(connection => ({ ...connection, ...validatePinUse(profile, connection) }));
  const uses = new Map();
  rows.forEach((row, index) => {
    if (row.pin?.gpio == null) return;
    if (!uses.has(row.pin.gpio)) uses.set(row.pin.gpio, []);
    uses.get(row.pin.gpio).push(index);
  });
  for (const [gpio, indices] of uses) {
    if (indices.length < 2) continue;
    const roles = new Set(indices.map(index => rows[index].role));
    const sharedBus = roles.size === 1 && SHAREABLE.has([...roles][0]);
    const names = indices.map(index => rows[index].component || rows[index].role).join(', ');
    for (const index of indices) {
      const row = rows[index];
      if (sharedBus) {
        row.reasons = [...row.reasons, `GPIO${gpio} is a shared ${row.role} bus line (${names}).`];
        continue;
      }
      if (RANK[row.verdict] < RANK.conflict) Object.assign(row, { verdict: 'conflict', label: VERDICT_LABEL.conflict });
      row.reasons = [`GPIO${gpio} is assigned more than once (${names}).`, ...row.reasons];
    }
  }
  const worst = worstVerdict(rows.map(row => row.verdict));
  return { board: profile?.id || null, rows, verdict: worst, label: VERDICT_LABEL[worst], electricallyVerified: false };
}

/** Candidate pins for a role, best first: no restriction, then warnings, then pins that need adaptation. */
export function suggestPins(profile, request = {}, { exclude = [] } = {}) {
  const skip = new Set(exclude.map(gpioNumber));
  return (profile?.pins || [])
    .filter(pin => pin.type === 'gpio' && !pin.reserved && !skip.has(pin.gpio))
    .map(pin => validatePinUse(profile, { ...request, pin: undefined, gpio: pin.gpio }))
    .filter(result => RANK[result.verdict] >= RANK.compatible && RANK[result.verdict] <= RANK.requires_external_adaptation)
    .sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || a.pin.pin - b.pin.pin);
}

/** Usable GPIO pins that a wiring plan has not taken yet. */
export function availablePins(profile, connections = []) {
  const used = new Set(wiringTable(profile, connections).map(row => row.gpio).filter(gpio => gpio != null));
  return (profile?.pins || []).filter(pin => pin.type === 'gpio' && !pin.reserved && !used.has(pin.gpio));
}

/** One row per connection: board pin, GPIO, VR identifier and address, and the component pin. */
export function wiringTable(profile, connections = []) {
  const prefix = profile?.pinPrefix || 'Pin';
  return connections.map(connection => {
    const pin = locatePin(profile, connection);
    return {
      name: connection.name || [connection.component, connection.componentPin].filter(Boolean).join(' '),
      component: connection.component || '',
      componentPin: connection.componentPin || '',
      role: connection.role || '',
      boardPin: pin?.pin ?? null,
      boardPinLabel: pin ? `${prefix} ${pin.pin}` : 'unassigned',
      gpio: pin?.type === 'gpio' ? pin.gpio : null,
      vr: pin?.vr || null,
      vrAddress: pin?.vrAddress || null,
    };
  });
}

/** A readable connection, in signal direction: "NanoKit Pin 36 · GPIO5 · TRIG → Ultrasonic sensor TRIG". */
export function connectionLabel(profile, connection) {
  const [row] = wiringTable(profile, [connection]);
  const board = row.gpio != null ? `${row.boardPinLabel} · GPIO${row.gpio}` : row.boardPinLabel;
  const signal = connection.signal || connection.componentPin || connection.role;
  const target = [row.component, row.componentPin].filter(Boolean).join(' ');
  const kind = ROLE_KIND[connection.role];
  if (kind === 'read' || kind === 'analog') return `${target} → ${board} · ${signal}`;
  if (kind === 'bidirectional') return `${board} · ${signal} ↔ ${target}`;
  return `${board} · ${signal} → ${target}`;
}

/** A C header with one #define per connection. Values are ESP32 GPIO numbers; comments give the board pin. */
export function pinHeader(profile, connections = []) {
  const symbol = text => String(text).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const guard = `${symbol(profile?.id || 'board')}_PINS_H`;
  const lines = [
    `// ${profile?.name || 'Board'} (${profile?.revision || 'revision not stated'}): pin assignments.`,
    `// Generated from the ${BOARD_SCHEMA} profile. Values are ESP32 GPIO numbers; comments give the board pin.`,
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
  ];
  for (const row of wiringTable(profile, connections)) {
    if (row.gpio == null) continue;
    const vr = row.vr ? `, ${row.vr}` : '';
    const target = [row.component, row.componentPin].filter(Boolean).join(' ');
    lines.push(`#define PIN_${symbol(row.name)} ${row.gpio}  // ${row.boardPinLabel}${vr}: ${target}`);
  }
  lines.push('', `#endif  // ${guard}`, '');
  return lines.join('\n');
}
