// -----------------------------------------------------------------------------
// The scene action "Get the air quality": one area, or the worst one.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered } from './helpers/world.js';
import { MARYLEBONE, NORBURY, WESTMINSTER } from './helpers/network.js';

async function world(language = 'fr') {
  const w = await createWorld({
    config: { boroughs: WESTMINSTER, sites: `${NORBURY} ${MARYLEBONE}`, language },
  });
  await createAll(w);
  return w;
}

test('one area: its band, indices and a sentence', async () => {
  const w = await world('en');
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {
    area: discovered(w, '33').external_id,
  });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs ?? ack.data, {
    area_name: 'London Air Westminster',
    band: 'low',
    band_label: 'Low',
    index: 2,
    pollutant: 'O₃',
    pm25: 1,
    pm10: 1,
    no2: 1,
    o3: 2,
    age_minutes: 20,
    summary: 'London Air Westminster: Low (2) · PM2.5 1 · PM10 1 · NO₂ 1 · O₃ 2',
  });
});

test('no area chosen: the worst index, the first configured on a tie', async () => {
  const w = await world();
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {});
  const outputs = ack.data.outputs ?? ack.data;
  assert.equal(outputs.area_name, 'London Air Westminster');
  assert.equal(outputs.band_label, 'Faible');
  assert.equal(outputs.so2, undefined, 'no data: left out');
});

test('nothing recent: the action fails with a message in four languages', async () => {
  const w = await world();
  w.advance(7 * 3_600_000);
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {});
  assert.equal(ack.success, false);
  assert.match(ack.error, /No air quality reading yet\. \/ Pas encore/);
});
