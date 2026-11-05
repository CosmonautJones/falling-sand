import test from 'node:test';
import assert from 'node:assert/strict';
import { transmission, fresnel } from '../public/v2/lab/render.js';

test('optical transmission composes through thickness without creating energy', () => {
  assert.equal(transmission(0.2, 0), 1);
  assert.ok(transmission(0.2, 10) < transmission(0.2, 2));
  assert.ok(Math.abs(transmission(0.2, 2) * transmission(0.2, 3) - transmission(0.2, 5)) < 1e-12);
});

test('water Fresnel reflects about 2% head-on and approaches one at grazing angles', () => {
  assert.ok(fresnel(1) > 0.019 && fresnel(1) < 0.021);
  assert.equal(fresnel(0), 1);
  assert.ok(fresnel(0.2) > fresnel(0.8));
  for (const cosine of [-1, 0, 0.3, 1, 2]) assert.ok(fresnel(cosine) >= 0 && fresnel(cosine) <= 1);
});
