// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered from the real
// London Air bulletin: every borough with sites and a few sites (a single
// pollutant, five pollutants, no data), in every feature-name language.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorld } from './helpers/world.js';
import { CAMDEN, MARYLEBONE, NORBURY } from './helpers/network.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

// Every borough that has sites (21, with Camden), and three sites.
const BOROUGHS = [
  CAMDEN,
  1,
  3,
  4,
  8,
  10,
  11,
  12,
  14,
  16,
  17,
  20,
  22,
  23,
  24,
  25,
  27,
  28,
  30,
  32,
  33,
];
const SITES = [MARYLEBONE, NORBURY, 'BL0'];

for (const language of ['fr', 'en', 'de', 'es']) {
  test(`every discovered device follows the Gladys rules (names in "${language}")`, async () => {
    const devices = [];
    // Ten areas at most per configuration: in batches.
    const areas = [
      ...BOROUGHS.map((b) => ({ boroughs: String(b) })),
      ...SITES.map((s) => ({ sites: s })),
    ];
    for (let i = 0; i < areas.length; i += 10) {
      const batch = areas.slice(i, i + 10);
      const config = {
        boroughs: batch
          .map((a) => a.boroughs)
          .filter(Boolean)
          .join(','),
        sites: batch
          .map((a) => a.sites)
          .filter(Boolean)
          .join(','),
        language,
      };
      const { gladys } = await createWorld({ config });
      assert.equal(gladys.fake.discoveredDevices.length, batch.length, 'one device per area');
      devices.push(...gladys.fake.discoveredDevices);
    }
    assert.equal(devices.length, BOROUGHS.length + SITES.length);

    for (const device of devices) {
      const where = device.name;

      // should_poll: true if and only if poll_frequency is provided, in ms.
      if (device.poll_frequency === undefined) {
        assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
      } else {
        assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
        assert.ok(
          table.poll_frequencies_ms.includes(device.poll_frequency),
          `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
        );
      }

      assert.ok(device.features.length > 0, `${where}: no feature`);
      const externalIds = new Set();
      const names = new Set();
      for (const feature of device.features) {
        const at = `${where} / ${feature.name}`;
        const pair = table.pairs[`${feature.category}/${feature.type}`];
        assert.ok(pair, `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`);
        assert.ok(
          pair.label_en && pair.label_fr && pair.icon,
          `${at}: couple without label or icon`,
        );

        assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
        assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
        assert.ok(
          Number.isFinite(feature.min) && Number.isFinite(feature.max),
          `${at}: finite min/max`,
        );
        assert.ok(feature.min <= feature.max, `${at}: min > max`);
        assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
        assert.equal(
          typeof feature.has_feedback,
          'boolean',
          `${at}: has_feedback must be a boolean`,
        );
        if (feature.unit !== undefined) {
          assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
          const allowed = table.units_by_category[feature.category];
          if (allowed) {
            assert.ok(
              allowed.flat().includes(feature.unit),
              `${at}: unit ${feature.unit} not offered for ${feature.category}`,
            );
          }
        }

        assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
        externalIds.add(feature.external_id);
        assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
        names.add(feature.name);
      }
    }
  });
}
