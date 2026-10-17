// Project: Git Architecture Diagram | Unit tests: the NanoKit Integrated ESP32 board profile (gad.board/1) and the pin check (public/boards.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BOARD_SCHEMA, VERDICTS, checkBoardShape, pinByNumber, pinByGpio, validatePinUse, checkWiring, suggestPins, availablePins, wiringTable, connectionLabel, pinHeader, worstVerdict, gpioNumber } from '../public/boards.js';

const nanokit = JSON.parse(readFileSync('public/assets/boards/nanokit-integrated-esp32.pinout.json', 'utf8'));
const gpiosWhere = flag => nanokit.pins.filter(pin => pin.type === 'gpio' && pin[flag]).map(pin => pin.gpio).sort((a, b) => a - b);

// The official ultrasonic_distance example: TRIG on NanoKit pin 36 (GPIO5), ECHO on pin 2 (GPIO34), HC-SR04-class sensor at 5 V.
const ultrasonic = [
  { name: 'ULTRASONIC_TRIG', component: 'Ultrasonic sensor', componentPin: 'TRIG', role: 'trigger', pin: 36 },
  { name: 'ULTRASONIC_ECHO', component: 'Ultrasonic sensor', componentPin: 'ECHO', role: 'echo', pin: 2, signalVoltage: 5 },
];

test('the profile is a well-formed gad.board/1 record with all 40 physical pins, each listed once', () => {
  assert.equal(nanokit.schema, BOARD_SCHEMA);
  assert.deepEqual(checkBoardShape(nanokit), []);
  assert.equal(nanokit.pinCount, 40);
  assert.deepEqual(nanokit.pins.map(pin => pin.pin), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(nanokit.name, 'NanoKit Integrated ESP32 Development Board');
  assert.equal(nanokit.manufacturer, 'Pro_Amine LLC');
  assert.equal(nanokit.revision, 'V2020 SMD/THT');
  const types = nanokit.pins.reduce((count, pin) => ({ ...count, [pin.type]: (count[pin.type] || 0) + 1 }), {});
  assert.deepEqual(types, { reference: 1, gpio: 32, power: 4, ground: 2, control: 1 });
});

test('physical pins map to the documented GPIO numbers, which are not the pin numbers', () => {
  // From docs/hardware/nanokit-integrated-esp32-pinout.md, docs/Wiring.md of the ultrasonic example, and the V2020 diagram.
  const expected = { 2: 34, 3: 25, 4: 39, 5: 36, 6: 35, 7: 32, 8: 13, 9: 15, 10: 4, 15: 14, 16: 19, 17: 2, 18: 22, 19: 27, 20: 33, 21: 11, 22: 10, 23: 21, 24: 23, 25: 1, 26: 3, 27: 9, 28: 6, 29: 7, 30: 8, 33: 12, 34: 0, 36: 5, 37: 26, 38: 18, 39: 17, 40: 16 };
  for (const [pin, gpio] of Object.entries(expected)) assert.equal(pinByNumber(nanokit, pin).gpio, gpio, `pin ${pin}`);
  assert.equal(Object.keys(expected).length, nanokit.pins.filter(pin => pin.type === 'gpio').length, 'every GPIO pin is checked');
  assert.equal(pinByGpio(nanokit, 'GPIO5').pin, 36);
  assert.equal(pinByGpio(nanokit, 34).pin, 2);
  assert.equal(gpioNumber('gpio21'), 21);
  for (const pin of [11, 32]) assert.equal(pinByNumber(nanokit, pin).rail, '+5V');
  for (const pin of [13, 14]) assert.equal(pinByNumber(nanokit, pin).rail, '+3V3');
  for (const pin of [12, 31]) assert.equal(pinByNumber(nanokit, pin).type, 'ground');
  assert.equal(pinByNumber(nanokit, 35).label, 'EN');
  assert.equal(pinByNumber(nanokit, 1).type, 'reference');
});

test('VR identifiers and addresses follow the documented addressing, and none is invented twice', () => {
  const sample = { 17: ['VR_PWM_OUT0', '0xC0'], 18: ['VR_I2C_SCL0', '0x31'], 23: ['VR_I2C_SDA0', '0x30'], 34: ['VR_BOOT', '0x38'], 35: ['VR_RST', '0xFF'], 36: ['VR_SPI_CS1', '0x17'], 39: ['VR_UART_TX2', '0x05'], 40: ['VR_UART_RX2', '0x04'], 12: ['VR_GND', '0xD0'] };
  for (const [pin, [vr, address]] of Object.entries(sample)) assert.deepEqual([pinByNumber(nanokit, pin).vr, pinByNumber(nanokit, pin).vrAddress], [vr, address], `pin ${pin}`);
  // Internal consistency of the VR scheme, which settled the ADC addresses: VR_ADC_INx = 0x50 + x, VR_GPIOnn = 0x80 + nn.
  for (const pin of nanokit.pins) {
    const adc = pin.vr?.match(/^VR_ADC_IN(\d+)$/); if (adc) assert.equal(Number(pin.vrAddress), 0x50 + Number(adc[1]), pin.vr);
    const gpio = pin.vr?.match(/^VR_GPIO(\d{2})$/); if (gpio) assert.equal(Number(pin.vrAddress), 0x80 + Number(gpio[1]), pin.vr);
  }
  const gpioPins = nanokit.pins.filter(pin => pin.type === 'gpio');
  for (const pin of gpioPins) assert.match(pin.vrAddress, /^0x[0-9A-F]{2}$/, `pin ${pin.pin}`);
  assert.equal(new Set(gpioPins.map(pin => pin.vr)).size, gpioPins.length, 'one VR identifier per GPIO pin');
  assert.equal(new Set(gpioPins.map(pin => pin.vrAddress)).size, gpioPins.length, 'one VR address per GPIO pin');
});

test('the documented restrictions are data in the profile, exactly as the references list them', () => {
  assert.deepEqual(gpiosWhere('inputOnly'), [34, 35, 36, 39]);
  assert.deepEqual(nanokit.pins.filter(pin => pin.reserved === 'spi-flash').map(pin => pin.gpio).sort((a, b) => a - b), [6, 7, 8, 9, 10, 11]);
  assert.deepEqual(gpiosWhere('strapping'), [0, 2, 5, 12, 15]);
  assert.deepEqual(gpiosWhere('boot'), [0]);
  assert.deepEqual(gpiosWhere('usbSerial'), [1, 3]);
  assert.deepEqual(gpiosWhere('dac'), [25, 26]);
  assert.equal(nanokit.logicVoltage, 3.3);
  assert.equal(nanokit.fiveVoltTolerant, false);
  assert.match(pinByNumber(nanokit, 17).notes, /not confirmed/, 'the onboard LED on GPIO2 is not asserted as fact');
});

test('input-only, flash, power, ground, and EN pins are refused for outputs, with the reason', () => {
  for (const gpio of [34, 35, 36, 39]) {
    const result = validatePinUse(nanokit, { gpio, role: 'led' });
    assert.equal(result.verdict, 'forbidden', `GPIO${gpio}`); assert.match(result.reasons[0], /input-only/);
    assert.equal(validatePinUse(nanokit, { gpio, role: 'button' }).verdict, 'compatible', `GPIO${gpio} may read`);
    assert.equal(validatePinUse(nanokit, { gpio, role: 'i2c_sda' }).verdict, 'forbidden', 'an open-drain bus needs to drive the line');
  }
  for (const gpio of [6, 7, 8, 9, 10, 11]) {
    const result = validatePinUse(nanokit, { gpio, role: 'input' });
    assert.equal(result.verdict, 'forbidden'); assert.match(result.reasons[0], /SPI flash/);
  }
  for (const [pin, word] of [[11, 'power'], [13, 'power'], [12, 'ground'], [35, 'control'], [1, 'reference']]) {
    const result = validatePinUse(nanokit, { pin, role: 'output' });
    assert.equal(result.verdict, 'forbidden', `pin ${pin}`); assert.match(result.reasons[0], new RegExp(`${word}.*not a GPIO`));
  }
});

test('boot, strapping, USB-serial, ADC2, and DAC rules give a warning or a conflict with the reason', () => {
  const boot = validatePinUse(nanokit, { gpio: 0, role: 'button' });
  assert.equal(boot.verdict, 'compatible_with_warning'); assert.match(boot.reasons[0], /BOOT pin/);
  const gpio12 = validatePinUse(nanokit, { gpio: 12, role: 'output' });
  assert.equal(gpio12.verdict, 'compatible_with_warning'); assert.match(gpio12.reasons[0], /strapping pin.*expected low/);
  assert.match(validatePinUse(nanokit, { gpio: 1, role: 'uart_tx' }).reasons.join(' '), /Serial Monitor/);
  const adc2 = validatePinUse(nanokit, { gpio: 4, role: 'adc' });
  assert.equal(adc2.verdict, 'compatible_with_warning'); assert.match(adc2.reasons[0], /Wi-Fi/);
  assert.equal(validatePinUse(nanokit, { gpio: 34, role: 'adc' }).verdict, 'compatible', 'ADC1 has no Wi-Fi restriction');
  assert.equal(validatePinUse(nanokit, { gpio: 22, role: 'adc' }).verdict, 'conflict', 'no ADC channel');
  assert.equal(validatePinUse(nanokit, { gpio: 25, role: 'dac' }).verdict, 'compatible', 'DAC output has no ADC2 or strapping rule');
  assert.equal(validatePinUse(nanokit, { gpio: 4, role: 'dac' }).verdict, 'conflict');
  assert.equal(validatePinUse(nanokit, { gpio: 18, role: 'spi_sclk' }).verdict, 'compatible');
});

test('voltage: a 5 V signal into a 3.3 V input needs adaptation; a 3.3 V one does not; drive thresholds are never assumed', () => {
  const echo5 = validatePinUse(nanokit, { pin: 2, role: 'echo', signalVoltage: 5 });
  assert.equal(echo5.verdict, 'requires_external_adaptation'); assert.match(echo5.reasons[0], /level shifter or a divider/);
  assert.equal(validatePinUse(nanokit, { pin: 2, role: 'echo', signalVoltage: 3.3 }).verdict, 'compatible');
  assert.equal(validatePinUse(nanokit, { gpio: 21, role: 'i2c_sda', signalVoltage: 5 }).verdict, 'requires_external_adaptation', 'pull-ups to 5 V');
  assert.equal(validatePinUse(nanokit, { gpio: 23, role: 'output', targetMinHighVoltage: 3.5 }).verdict, 'requires_external_adaptation');
  assert.equal(validatePinUse(nanokit, { gpio: 23, role: 'output', targetMinHighVoltage: 2 }).verdict, 'compatible');
  const unknown = validatePinUse(nanokit, { gpio: 23, role: 'output', targetSupplyVoltage: 5 });
  assert.equal(unknown.verdict, 'compatible_with_warning'); assert.match(unknown.reasons[0], /not verified/);
});

test('the official ultrasonic wiring maps correctly: TRIG warns (strapping), ECHO at 5 V needs a level shifter', () => {
  const plan = checkWiring(nanokit, ultrasonic);
  assert.equal(plan.rows[0].pin.gpio, 5); assert.equal(plan.rows[0].pin.pin, 36);
  assert.equal(plan.rows[0].verdict, 'compatible_with_warning'); assert.match(plan.rows[0].reasons[0], /strapping pin.*expected high/);
  assert.equal(plan.rows[1].pin.gpio, 34); assert.equal(plan.rows[1].pin.pin, 2);
  assert.equal(plan.rows[1].verdict, 'requires_external_adaptation');
  assert.equal(plan.verdict, 'requires_external_adaptation');
  assert.equal(plan.electricallyVerified, false, 'documentation rules are never an electrical verification');
  assert.equal(connectionLabel(nanokit, ultrasonic[0]), 'NanoKit Pin 36 · GPIO5 · TRIG → Ultrasonic sensor TRIG');
  assert.equal(connectionLabel(nanokit, ultrasonic[1]), 'Ultrasonic sensor ECHO → NanoKit Pin 2 · GPIO34 · ECHO');
  // checkWiring rows carry a pin summary where the request had a pin number; labels, tables, and headers read both alike.
  assert.deepEqual(plan.rows.map(row => connectionLabel(nanokit, row)), ultrasonic.map(connection => connectionLabel(nanokit, connection)));
  assert.deepEqual(wiringTable(nanokit, plan.rows), wiringTable(nanokit, ultrasonic));
  assert.equal(pinHeader(nanokit, plan.rows), pinHeader(nanokit, ultrasonic));
  assert.deepEqual(checkWiring(nanokit, plan.rows).rows.map(row => row.verdict), plan.rows.map(row => row.verdict), 'checking a checked plan gives the same verdicts');
});

test('the generated header and the wiring table agree, and both use GPIO numbers with the board pin in comments', () => {
  const table = wiringTable(nanokit, ultrasonic);
  const header = pinHeader(nanokit, ultrasonic);
  const defines = Object.fromEntries([...header.matchAll(/^#define PIN_(\w+) (\d+)  \/\/ (NanoKit Pin \d+)/gm)].map(([, name, gpio, pin]) => [name, { gpio: Number(gpio), pin }]));
  assert.deepEqual(defines, { ULTRASONIC_TRIG: { gpio: 5, pin: 'NanoKit Pin 36' }, ULTRASONIC_ECHO: { gpio: 34, pin: 'NanoKit Pin 2' } });
  for (const row of table) assert.equal(defines[row.name].gpio, row.gpio, row.name);
  assert.match(header, /^#ifndef NANOKIT_INTEGRATED_ESP32_PINS_H$/m);
  assert.match(header, /VR_SPI_CS1: Ultrasonic sensor TRIG/);
  assert.equal(table[1].vrAddress, '0x56');
});

test('conflicts: a GPIO used twice conflicts unless it is the same shared bus line; pin and GPIO must agree', () => {
  const clash = checkWiring(nanokit, [{ component: 'LED', role: 'led', gpio: 23 }, { component: 'Relay', role: 'relay', gpio: 23 }]);
  assert.deepEqual(clash.rows.map(row => row.verdict), ['conflict', 'conflict']); assert.match(clash.rows[0].reasons[0], /assigned more than once \(LED, Relay\)/);
  const bus = checkWiring(nanokit, [{ component: 'OLED', role: 'i2c_sda', gpio: 21 }, { component: 'BME280', role: 'i2c_sda', gpio: 21 }]);
  assert.deepEqual(bus.rows.map(row => row.verdict), ['compatible', 'compatible']); assert.match(bus.rows[0].reasons.at(-1), /shared i2c_sda bus line/);
  const cs = checkWiring(nanokit, [{ component: 'Flash', role: 'spi_cs', gpio: 15 }, { component: 'SD card', role: 'spi_cs', gpio: 15 }]);
  assert.equal(cs.verdict, 'conflict', 'chip-select lines are never shared');
  const mismatch = validatePinUse(nanokit, { pin: 36, gpio: 36, role: 'output' });
  assert.equal(mismatch.verdict, 'conflict'); assert.match(mismatch.reasons[0], /pin number is not the GPIO number/);
  assert.equal(validatePinUse(nanokit, { gpio: 99, role: 'output' }).verdict, 'unknown');
  assert.equal(validatePinUse(nanokit, { gpio: 23, role: 'teleport' }).verdict, 'unknown');
  assert.equal(checkWiring(nanokit, []).verdict, 'unknown', 'an empty plan proves nothing');
});

test('alternatives: suggested pins put unrestricted pins first and never offer refused ones', () => {
  const led = suggestPins(nanokit, { role: 'led' });
  assert.ok(led.length > 10);
  assert.equal(led[0].verdict, 'compatible');
  for (const result of led) {
    assert.ok(![34, 35, 36, 39, 6, 7, 8, 9, 10, 11].includes(result.pin.gpio), `GPIO${result.pin.gpio}`);
    assert.ok(VERDICTS.indexOf(result.verdict) <= VERDICTS.indexOf('compatible') && result.verdict !== 'forbidden' && result.verdict !== 'conflict');
  }
  const firstWarning = led.findIndex(result => result.verdict !== 'compatible');
  assert.ok(led.slice(firstWarning).every(result => result.verdict !== 'compatible'), 'ordered best first');
  const analog = suggestPins(nanokit, { role: 'adc' }, { exclude: ['GPIO34'] });
  assert.ok(analog.every(result => result.pin.gpio !== 34));
  assert.equal(analog[0].verdict, 'compatible', 'an ADC1 pin comes before ADC2 pins');
  const free = availablePins(nanokit, ultrasonic).map(pin => pin.gpio);
  assert.ok(!free.includes(5) && !free.includes(34) && !free.includes(6));
  assert.equal(free.length, 32 - 6 - 2, 'GPIO pins, minus flash, minus the two used');
});

test('the PlatformIO baseline and the Altium references come from the official sources and are not overstated', () => {
  assert.deepEqual({ ...nanokit.platformio, note: undefined }, { env: 'nanokit_esp32', platform: 'espressif32', board: 'esp32dev', framework: 'arduino', monitorSpeed: 115200, uploadSpeed: 921600, note: undefined });
  assert.match(nanokit.platformio.note, /no official NanoKit PlatformIO board/);
  const library = nanokit.sources.find(source => source.kind === 'library');
  assert.match(library.authority, /not redistributed, not parsed/);
  assert.ok(!readdirSync('public/assets/boards').some(name => /\.intlib$/i.test(name)), 'no Altium library is copied into the site');
});

test('the check is driven by the profile: another board needs only another profile', () => {
  const tiny = { schema: BOARD_SCHEMA, id: 'tiny-board', name: 'Tiny test board', pinCount: 4, logicVoltage: 5, fiveVoltTolerant: true, pins: [
    { pin: 1, type: 'power', label: 'VCC' }, { pin: 2, type: 'gpio', gpio: 7 }, { pin: 3, type: 'gpio', gpio: 8, inputOnly: true }, { pin: 4, type: 'ground', label: 'GND' },
  ] };
  assert.deepEqual(checkBoardShape(tiny), []);
  assert.equal(validatePinUse(tiny, { pin: 2, role: 'echo', signalVoltage: 5 }).verdict, 'compatible', 'a 5 V board accepts a 5 V signal');
  assert.equal(validatePinUse(tiny, { gpio: 8, role: 'led' }).verdict, 'forbidden');
  assert.equal(connectionLabel(tiny, { component: 'LED', role: 'led', gpio: 7 }), 'Pin 2 · GPIO7 · led → LED');
  const broken = { ...tiny, pins: [...tiny.pins.slice(0, 3), { pin: 3, type: 'power', gpio: 9 }] };
  assert.deepEqual(checkBoardShape(broken), ['pin 3: listed twice', 'pin 3: a power pin has no GPIO']);
  assert.equal(worstVerdict(['compatible', 'unknown']), 'unknown');
  assert.equal(worstVerdict(['compatible_with_warning', 'forbidden', 'conflict']), 'forbidden');
});
