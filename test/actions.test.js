// -----------------------------------------------------------------------------
// The buttons of the Configuration screen: find an area, check the areas.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';
import { MARYLEBONE, WESTMINSTER } from './helpers/network.js';
import { Catalog, searchAreas } from '../src/catalog.js';
import { fold } from '../src/config.js';

// A house near Baker Street.
const HOUSE = { selector: 'home', name: 'Home', latitude: 51.5226, longitude: -0.1571 };

test('find by name: the boroughs and the sites matching, sorted by name', async () => {
  const w = await createWorld({ houses: [HOUSE] });
  const ack = await w.gladys.fake.action('find_area', { query: 'camden' });
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    [
      'Boroughs for "camden", to type in "Boroughs":',
      'Camden, 2 site(s)',
      'Sites for "camden", to type in "Sites":',
      'BL0 Camden - Bloomsbury',
      'CD1 Camden - Swiss Cottage',
    ].join('\n'),
  );
});

test('a site code is found too', async () => {
  const w = await createWorld();
  const ack = await w.gladys.fake.action('find_area', { query: 'my1' });
  assert.equal(ack.data.message.en.split('\n')[1], 'MY1 Westminster - Marylebone Road');
});

test('no name: the nearest to the house, with their distance', async () => {
  const w = await createWorld({ houses: [HOUSE] });
  const ack = await w.gladys.fake.action('find_area', {});
  const lines = ack.data.message.fr.split('\n');
  assert.equal(lines[0], 'Arrondissements autour de Home, à saisir dans « Arrondissements » :');
  assert.equal(lines[6], 'Sites autour de Home, à saisir dans « Sites » :');
  assert.deepEqual(lines.slice(7, 9).sort(), [
    'MR8 Marylebone Road - BAM (0.2 km)',
    'MY1 Westminster - Marylebone Road (0.2 km)',
  ]);
  assert.match(lines.at(-1), /^…et \d+ autres : affinez la recherche\.$/);
  // The list comes with the bulletin, read at start-up: no other request.
  assert.equal(w.network.calls.length, 1);
});

test('no name and no located house: the action says what to do', async () => {
  const w = await createWorld({ houses: [{ selector: 'h', name: 'H' }] });
  const ack = await w.gladys.fake.action('find_area', {});
  assert.equal(ack.success, false);
  assert.match(ack.error, /Settings → Houses/);
});

test('the list unreachable: a clear message', async () => {
  const w = await createWorld({ setup: (network) => (network.down = true) });
  const ack = await w.gladys.fake.action('find_area', { query: 'Camden' });
  assert.equal(ack.success, false);
  assert.match(ack.error, /cannot be read now/);
});

test('check the areas: band, pollutants, age', async () => {
  const w = await createWorld({ config: { boroughs: WESTMINSTER, sites: MARYLEBONE } });
  const ack = await w.gladys.fake.action('check_areas', {});
  assert.equal(
    ack.data.message.en,
    [
      'London Air Westminster (33): Low (2), PM2.5, PM10, NO₂, O₃, SO₂ (20 min ago)',
      'London Air Westminster - Marylebone Road (MY1): Low (2), NO₂, O₃, SO₂ (20 min ago)',
    ].join('\n'),
  );
  const none = await (await createWorld()).gladys.fake.action('check_areas', {});
  assert.equal(none.data.message.en, 'No borough or site is configured.');
});

test('search helpers: folding and ordering', () => {
  assert.equal(fold('Kensington & Chelsea'), 'kensington and chelsea');
  const catalog = new Catalog();
  catalog.update(
    [
      {
        code: '1',
        name: 'B',
        lat: 51.5,
        lon: 0,
        sites: [{ code: 'X1', name: 'B - far', lat: 51.6, lon: 0.2 }],
      },
      { code: '2', name: 'A', lat: null, lon: null, sites: [] },
    ],
    0,
  );
  assert.deepEqual(
    searchAreas(catalog, {}).boroughs.map((b) => b.code),
    ['2', '1'],
  );
  assert.deepEqual(
    searchAreas(catalog, { origin: { lat: 51.5, lon: 0 } }).boroughs.map((b) => b.code),
    ['1', '2'],
  );
  assert.equal(catalog.resolveBorough('#1')?.name, 'B');
  assert.equal(catalog.resolveBorough('a'), catalog.borough('2'));
});
