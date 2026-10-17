// Project: Git Architecture Diagram | Unit tests: the hardware panel model (public/hardware-panel.js) over the NanoKit profile, and its ToolHub capabilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pinMap, pinDetail, interfaceSummary, hardwareReport, pinRestrictions } from '../public/hardware-panel.js';
import { defaultRegistry, nanokitElectronicsAdapter } from '../public/adapters.js';
import { makeJob, runJob } from '../public/toolhub.js';

const nanokit = JSON.parse(readFileSync('public/assets/boards/nanokit-integrated-esp32.pinout.json', 'utf8'));
const ultrasonic = [
  { name: 'ULTRASONIC_TRIG', component: 'Ultrasonic sensor', componentPin: 'TRIG', role: 'trigger', pin: 36 },
  { name: 'ULTRASONIC_ECHO', component: 'Ultrasonic sensor', componentPin: 'ECHO', role: 'echo', pin: 2, signalVoltage: 5 },
];

test('the pin map has all 40 pins, split into two sides, with usable flags and restrictions', () => {
  const map = pinMap(nanokit);
  assert.equal(map.length, 40);
  assert.deepEqual(map.map(entry => entry.pin), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(map.filter(entry => entry.side === 'left').length, 20);
  assert.equal(map.filter(entry => entry.side === 'right').length, 20);
  assert.equal(map.filter(entry => entry.usable).length, 26, '32 GPIO minus 6 flash');
  const flash = map.find(entry => entry.pin === 21);
  assert.equal(flash.usable, false); assert.match(flash.restrictions[0], /internal SPI flash/);
  const trig = map.find(entry => entry.pin === 36);
  assert.equal(trig.gpio, 5); assert.ok(trig.flags.strapping); assert.ok(trig.interfaces.includes('spi'));
  const power = map.find(entry => entry.pin === 11);
  assert.equal(power.gpio, null); assert.equal(power.usable, false); assert.match(power.restrictions[0], /not a GPIO/);
});

test('pin detail gives the roles a pin could take, each with an honest verdict', () => {
  const trig = pinDetail(nanokit, 36);
  assert.equal(trig.gpio, 5);
  assert.deepEqual(trig.restrictions, ['Strapping pin — expected high at power-on']);
  const output = trig.roles.find(entry => entry.role === 'output');
  assert.equal(output.verdict, 'compatible_with_warning'); assert.match(output.reasons[0], /strapping/);
  const echo = pinDetail(nanokit, 2);
  assert.equal(echo.gpio, 34);
  assert.deepEqual(echo.restrictions, ['Input only']);
  assert.equal(echo.roles.find(entry => entry.role === 'output').verdict, 'forbidden');
  assert.equal(echo.roles.find(entry => entry.role === 'input').verdict, 'compatible');
  assert.equal(echo.roles.find(entry => entry.role === 'adc').verdict, 'compatible', 'ADC1, no Wi-Fi restriction');
  assert.ok(!echo.roles.some(entry => entry.role === 'pwm'), 'an input-only pin is not offered for PWM');
  const flash = pinDetail(nanokit, 21);
  assert.deepEqual(flash.roles, [], 'a reserved pin offers no roles');
  const adc2 = pinDetail(nanokit, 10).roles.find(entry => entry.role === 'adc');
  assert.equal(adc2.verdict, 'compatible_with_warning'); assert.match(adc2.reasons[0], /Wi-Fi/);
  assert.equal(pinDetail(nanokit, 99), null);
});

test('the interface summary counts pins and lists the fixed bus pins', () => {
  const summary = interfaceSummary(nanokit);
  assert.equal(summary.board, 'NanoKit Integrated ESP32');
  assert.deepEqual(summary.counts, { gpio: 32, usable: 26, inputOnly: 4, flashReserved: 6, power: 4, ground: 2, strapping: 5 });
  assert.deepEqual(summary.interfaces.i2c, [21, 22]);
  assert.deepEqual(summary.interfaces.uart, [1, 3, 16, 17]);
  assert.deepEqual(summary.interfaces.dac, [25, 26]);
  assert.ok(summary.interfaces.adc1.includes(34) && !summary.interfaces.adc1.includes(4));
  assert.ok(summary.interfaces.adc2.includes(4));
  assert.equal(summary.logicVoltage, 3.3);
  assert.equal(summary.fiveVoltTolerant, false);
});

test('the hardware report combines the map, the summary, the wiring check, and the free pins, and is never verified', () => {
  const report = hardwareReport(nanokit, ultrasonic);
  assert.equal(report.board.name, 'NanoKit Integrated ESP32 Development Board');
  assert.equal(report.map.length, 40);
  assert.equal(report.wiring.verdict, 'requires_external_adaptation');
  assert.equal(report.table[0].gpio, 5); assert.equal(report.table[1].gpio, 34);
  assert.ok(!report.available.some(entry => entry.gpio === 5 || entry.gpio === 34), 'used pins are not offered as free');
  assert.equal(report.available.length, 24, '26 usable minus the 2 used');
  assert.equal(report.electricallyVerified, false);
  assert.deepEqual(pinRestrictions({ type: 'ground', label: 'GND' }), ['GND — not a GPIO']);
});

test('the NanoKit ToolHub adapter exposes the hardware capabilities and runs them', async () => {
  const names = nanokitElectronicsAdapter.capabilities.map(capability => capability.id);
  for (const capability of ['pin-map', 'pin-detail', 'interface-summary', 'hardware-report']) assert.ok(names.includes(capability), capability);
  const registry = defaultRegistry();
  const map = await runJob(registry, makeJob('electronics-nanokit', 'pin-map', { board: nanokit }));
  assert.equal(map.ok, true); assert.deepEqual(map.output, pinMap(nanokit));
  const report = await runJob(registry, makeJob('electronics-nanokit', 'hardware-report', { board: nanokit, connections: ultrasonic }));
  assert.deepEqual(report.output, hardwareReport(nanokit, ultrasonic));
  const detail = await runJob(registry, makeJob('electronics-nanokit', 'pin-detail', { board: nanokit, pin: 23 }));
  assert.equal(detail.output.gpio, 21); assert.ok(detail.output.interfaces.includes('i2c'));
});
