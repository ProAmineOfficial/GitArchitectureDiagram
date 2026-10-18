// Project: Git Architecture Diagram | Unit test: public/space.js degrades safely when there is no <canvas> or no 2D
// context (old engines, or a stripped DOM). The returned object must expose the full API the app calls — setActive,
// setMotion AND motionOn — so syncSpaceMotion() never throws and the page stays usable without the decorative stars.
import test from 'node:test'; import assert from 'node:assert/strict';

// A minimal DOM stub with no canvas: getElementById returns null, which drives space.js down its fallback path.
globalThis.document = { getElementById: () => null, body: { classList: { toggle() {} } }, addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });

const { setupSpace } = await import('../public/space.js');

test('setupSpace returns the complete API when no canvas is available, and nothing throws', () => {
  const space = setupSpace();
  for (const method of ['setActive', 'setMotion', 'motionOn']) assert.equal(typeof space[method], 'function', `fallback must provide ${method}()`);
  assert.doesNotThrow(() => { space.setActive(true); space.setActive(false); space.setMotion(false); space.setMotion(true); });
  assert.equal(typeof space.motionOn(), 'boolean', 'motionOn() returns a usable value, not undefined');
});
