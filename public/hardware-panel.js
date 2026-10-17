// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: the hardware panel model, as pure functions (no DOM, no network), so
// the browser view and the Node tests share them.
//
// This turns a gad.board/1 profile (and an optional wiring plan) into the data a hardware panel renders: a 40-pin map,
// one pin's full detail with honest verdicts for the roles it could take, an interface summary, and a combined report
// over a wiring plan. Every verdict comes from public/boards.js, which encodes documented ESP32/NanoKit rules; nothing
// here is an electrical measurement. The DOM view that draws this model, and the NanoKit project that supplies a wiring
// plan, are separate.
import { pinByNumber, validatePinUse, checkWiring, wiringTable, availablePins } from './boards.js';

/** Interface a pin belongs to, read from its VR identifier and flags. A pin can appear under several. */
function interfacesOf(pin) {
  const names = [];
  if (/^VR_I2C/.test(pin.vr || '')) names.push('i2c');
  if (/^VR_SPI/.test(pin.vr || '')) names.push('spi');
  if (/^VR_UART/.test(pin.vr || '')) names.push('uart');
  if (/^VR_DAC/.test(pin.vr || '') || pin.dac) names.push('dac');
  if (pin.adc) names.push('adc1');
  if (pin.adc2) names.push('adc2');
  if (pin.pwm) names.push('pwm');
  if (pin.touch) names.push('touch');
  return names;
}

/** Short, human-readable restrictions for a pin, from its flags. */
export function pinRestrictions(pin) {
  const notes = [];
  if (pin.type !== 'gpio') { notes.push(`${pin.label || pin.type} — not a GPIO`); return notes; }
  if (pin.reserved === 'spi-flash') notes.push('Reserved for internal SPI flash — do not use');
  if (pin.inputOnly) notes.push('Input only');
  if (pin.boot) notes.push('BOOT pin — must be high at power-on');
  else if (pin.strapping) notes.push(`Strapping pin${pin.bootLevel ? ` — expected ${pin.bootLevel} at power-on` : ''}`);
  if (pin.usbSerial) notes.push('UART0 — shared with USB serial');
  if (pin.adc2 && !pin.adc) notes.push('ADC2 — unavailable while Wi-Fi is active');
  return notes;
}

/** Plausible roles to check for a pin, by what it can physically do. */
function rolesForPin(pin) {
  if (pin.type !== 'gpio' || pin.reserved) return [];
  const roles = ['output', 'input'];
  if (pin.adc || pin.adc2) roles.push('adc');
  if (!pin.inputOnly) roles.push('pwm');
  if (pin.dac) roles.push('dac');
  return roles;
}

/** The 40-pin map: one entry per physical pin, ordered by number, tagged with its connector side and flags. */
export function pinMap(profile) {
  const half = Math.ceil((profile?.pinCount || 40) / 2);
  return (profile?.pins || []).map(pin => ({
    pin: pin.pin,
    side: pin.pin <= half ? 'left' : 'right',
    type: pin.type,
    gpio: pin.type === 'gpio' ? pin.gpio : null,
    vr: pin.vr || null,
    vrAddress: pin.vrAddress || null,
    label: pin.label || (pin.type === 'gpio' ? `GPIO${pin.gpio}` : pin.type),
    functions: pin.functions || [],
    interfaces: interfacesOf(pin),
    usable: pin.type === 'gpio' && !pin.reserved,
    flags: { inputOnly: !!pin.inputOnly, strapping: !!pin.strapping, boot: !!pin.boot, reserved: pin.reserved || null, usbSerial: !!pin.usbSerial, adc2: !!pin.adc2, dac: !!pin.dac, pwm: !!pin.pwm },
    restrictions: pinRestrictions(pin),
  }));
}

/** One pin in full, with the verdict for each role it could take. */
export function pinDetail(profile, pinNumber) {
  const pin = pinByNumber(profile, pinNumber);
  if (!pin) return null;
  return {
    pin: pin.pin,
    type: pin.type,
    gpio: pin.type === 'gpio' ? pin.gpio : null,
    vr: pin.vr || null,
    vrAddress: pin.vrAddress || null,
    label: pin.label || (pin.type === 'gpio' ? `GPIO${pin.gpio}` : pin.type),
    functions: pin.functions || [],
    interfaces: interfacesOf(pin),
    restrictions: pinRestrictions(pin),
    roles: rolesForPin(pin).map(role => { const result = validatePinUse(profile, { gpio: pin.gpio, role }); return { role, verdict: result.verdict, reasons: result.reasons }; }),
  };
}

/** Counts and the fixed pins for each interface, for an overview header. */
export function interfaceSummary(profile) {
  const pins = profile?.pins || [];
  const gpio = pins.filter(pin => pin.type === 'gpio');
  const usable = gpio.filter(pin => !pin.reserved);
  const underInterface = name => usable.filter(pin => interfacesOf(pin).includes(name)).map(pin => pin.gpio).sort((a, b) => a - b);
  return {
    board: profile?.shortName || profile?.name || 'board',
    revision: profile?.revision || null,
    pinCount: profile?.pinCount || pins.length,
    counts: {
      gpio: gpio.length,
      usable: usable.length,
      inputOnly: gpio.filter(pin => pin.inputOnly).length,
      flashReserved: gpio.filter(pin => pin.reserved === 'spi-flash').length,
      power: pins.filter(pin => pin.type === 'power').length,
      ground: pins.filter(pin => pin.type === 'ground').length,
      strapping: gpio.filter(pin => pin.strapping).length,
    },
    interfaces: { i2c: underInterface('i2c'), spi: underInterface('spi'), uart: underInterface('uart'), adc1: underInterface('adc1'), adc2: underInterface('adc2'), dac: underInterface('dac'), pwm: underInterface('pwm'), touch: underInterface('touch') },
    logicVoltage: profile?.logicVoltage ?? null,
    fiveVoltTolerant: !!profile?.fiveVoltTolerant,
  };
}

/** Everything the hardware panel needs for a project's wiring over a board: map, summary, wiring check, table, free pins. */
export function hardwareReport(profile, connections = []) {
  return {
    board: { id: profile?.id || null, name: profile?.name || null, revision: profile?.revision || null, mcu: profile?.mcu || null },
    summary: interfaceSummary(profile),
    map: pinMap(profile),
    wiring: checkWiring(profile, connections),
    table: wiringTable(profile, connections),
    available: availablePins(profile, connections).map(pin => ({ pin: pin.pin, gpio: pin.gpio, vr: pin.vr })),
    electricallyVerified: false,
  };
}
