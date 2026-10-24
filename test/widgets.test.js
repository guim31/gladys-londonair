// -----------------------------------------------------------------------------
// The "Air quality" widget: every content fits the core's vocabulary and
// budget (validateWidgetContent: 8 components, 2 texts), and every tile is
// bound to a feature the device really has.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { createAll, createWorld, discovered } from './helpers/world.js';
import { MARYLEBONE, NORBURY, WESTMINSTER, bulletinAt } from './helpers/network.js';
import { bandColor } from '../src/widgets.js';
import { TEXT } from '../src/i18n.js';

const LANGS = ['en', 'fr', 'de', 'es'];

async function world() {
  const w = await createWorld({
    config: { boroughs: WESTMINSTER, sites: `${MARYLEBONE} ${NORBURY}` },
    setup: (network) => {
      network.index = bulletinAt('2026-10-24 08:00:00', { MY1: { O3: 5 } });
    },
  });
  await createAll(w);
  return w;
}

async function content(w, settings, language) {
  const ack = await w.gladys.fake.widgetGet('air_quality', { settings, language });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

/** Every device_feature of a content exists on a discovered device. */
function assertBound(w, widgetContent) {
  const known = new Set(
    w.gladys.fake.discoveredDevices.flatMap((d) => d.features.map((f) => f.external_id)),
  );
  for (const component of widgetContent.components) {
    if (component.device_feature) {
      assert.ok(known.has(component.device_feature), component.device_feature);
    }
  }
}

test('one area: four pollutant tiles, the band colored, the age, the source', async () => {
  const w = await world();
  for (const id of ['33', MARYLEBONE, NORBURY]) {
    for (const lang of LANGS) {
      const c = await content(w, { area: discovered(w, id).external_id }, lang);
      assert.deepEqual(validateWidgetContent(c), [], `${id} ${lang}`);
      assertBound(w, c);
    }
  }
  const c = await content(w, { area: discovered(w, '33').external_id }, 'fr');
  assert.deepEqual(
    c.components.filter((x) => x.type === 'value').map((x) => x.label),
    ['PM2.5', 'PM10', 'NO₂', 'O₃'],
  );
  const status = c.components.find((x) => x.type === 'status');
  assert.deepEqual(status.items[0], {
    label: "Pollution de l'air",
    value: 'Modéré (5)',
    color: WIDGET_COLORS.WARNING,
  });
  assert.equal(status.items[1].value, 'il y a 20 min');
  assert.equal(c.components.at(-1).text, TEXT.source.fr);
});

test('every area: one row each, colored by band', async () => {
  const w = await world();
  const c = await content(w, {}, 'en');
  assert.deepEqual(validateWidgetContent(c), []);
  assert.deepEqual(
    c.components[0].items.map((item) => [item.label, item.value, item.color]),
    [
      ['London Air Westminster', 'Moderate (5)', WIDGET_COLORS.WARNING],
      ['London Air Westminster - Marylebone Road', 'Moderate (5)', WIDGET_COLORS.WARNING],
      ['London Air Croydon - Norbury', 'Low (1)', WIDGET_COLORS.SUCCESS],
    ],
  );
});

test('stale data and an unknown area are said plainly', async () => {
  const w = await world();
  w.advance(7 * 3_600_000);
  const c = await content(w, { area: discovered(w, NORBURY).external_id }, 'de');
  const status = c.components.find((x) => x.type === 'status');
  assert.equal(status.items[0].value, 'Veraltet (7 Std.)');
  assert.equal(status.items[0].color, WIDGET_COLORS.NEUTRAL);
  const gone = await content(w, { area: 'ext:test-integration:site:zz9' }, 'es');
  assert.equal(gone.components[0].text, TEXT.unknownArea.es);
  const empty = await createWorld();
  const none = await content(empty, {}, 'fr');
  assert.equal(none.components[0].text, TEXT.noArea.fr);
});

test('the colors of the four bands', () => {
  assert.deepEqual([0, 1, 2, 3].map(bandColor), [
    WIDGET_COLORS.SUCCESS,
    WIDGET_COLORS.WARNING,
    WIDGET_COLORS.DANGER,
    WIDGET_COLORS.DANGER,
  ]);
});

test('no tile for a pollutant the Gladys device does not have yet', async () => {
  const w = await world();
  const device = w.gladys.fake.discoveredDevices.find((d) => d.external_id.endsWith(':my1'));
  const old = {
    ...device,
    features: device.features.filter((f) => !f.external_id.endsWith(':o3')),
  };
  await w.gladys.fake.deviceCreated(old);
  const c = await content(w, { area: device.external_id }, 'en');
  assert.deepEqual(
    c.components.filter((x) => x.type === 'value').map((x) => x.label),
    ['NO₂', 'SO₂'],
  );
});
