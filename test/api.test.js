// -----------------------------------------------------------------------------
// The London Air client against the real bulletin recorded on 2026-10-24
// (test/fixtures/londonair), and the UK local time of its dates.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, asList, daqi, fetchIndex } from '../src/api.js';
import { isSummerTime, parseLondonTime } from '../src/time.js';
import { createNetwork } from './helpers/network.js';

const deps = () => {
  const network = createNetwork();
  return { network, deps: { fetch: network.fetch } };
};

test('the bulletin: 33 boroughs, their sites, the index of each pollutant', async () => {
  const { deps: d, network } = deps();
  const boroughs = await fetchIndex(d);
  assert.equal(boroughs.length, 33);
  assert.equal(boroughs.filter((b) => b.sites.length === 0).length, 12);
  const westminster = boroughs.find((b) => b.code === '33');
  assert.equal(westminster.name, 'Westminster');
  const my1 = westminster.sites.find((s) => s.code === 'MY1');
  assert.deepEqual(my1, {
    code: 'MY1',
    name: 'Westminster - Marylebone Road',
    type: 'Kerbside',
    lat: 51.52254,
    lon: -0.15459,
    at: Date.parse('2026-10-24T07:00:00Z'),
    species: { no2: null, o3: 2, so2: null },
  });
  // A borough with a single site, a site with a single pollutant: lone objects.
  assert.equal(boroughs.find((b) => b.code === '23').sites[0].code, 'HP1');
  const croydon = boroughs.find((b) => b.code === '8');
  assert.deepEqual(croydon.sites.find((s) => s.code === 'CR5').species, { no2: 1 });
  assert.deepEqual(network.calls, ['/Hourly/MonitoringIndex/GroupName=London/Json']);
});

test('errors: unreachable, HTTP, not JSON, no index', async () => {
  const { deps: d, network } = deps();
  network.down = true;
  await assert.rejects(fetchIndex(d), (err) => err instanceof ApiError && err.unreachable);
  network.down = false;
  network.index = { status: 503 };
  await assert.rejects(fetchIndex(d), /HTTP 503/);
  network.index = { HourlyAirQualityIndex: { LocalAuthority: [] } };
  await assert.rejects(fetchIndex(d), /no borough/);
  network.index = [];
  await assert.rejects(fetchIndex(d), /no index/);
  const html = { fetch: async () => new Response('<html>', { status: 200 }) };
  await assert.rejects(fetchIndex(html), /unreadable/);
});

test('XML-shaped lists and DAQI values', () => {
  assert.deepEqual(asList(undefined), []);
  assert.deepEqual(asList({ a: 1 }), [{ a: 1 }]);
  assert.deepEqual(asList([{ a: 1 }, null, 'x']), [{ a: 1 }]);
  assert.equal(daqi('0'), null, '"No data"');
  assert.equal(daqi('10'), 10);
  assert.equal(daqi('11'), null);
  assert.equal(daqi(''), null);
  assert.equal(daqi('3.5'), null);
});

test('UK local time: BST in summer, GMT in winter, the October hour', () => {
  assert.equal(parseLondonTime('2026-10-24 08:00:00'), Date.parse('2026-10-24T07:00:00Z'));
  assert.equal(parseLondonTime('2026-12-01 08:00:00'), Date.parse('2026-12-01T08:00:00Z'));
  // 25 October 2026, 01:30 happens twice: the summer reading is kept.
  assert.equal(parseLondonTime('2026-10-25 01:30:00'), Date.parse('2026-10-25T00:30:00Z'));
  assert.equal(parseLondonTime('2026-10-25 02:30:00'), Date.parse('2026-10-25T02:30:00Z'));
  assert.equal(isSummerTime(Date.parse('2026-03-29T00:59:00Z')), false);
  assert.equal(isSummerTime(Date.parse('2026-03-29T01:00:00Z')), true);
  assert.equal(parseLondonTime('yesterday'), null);
  assert.equal(parseLondonTime(undefined), null);
});
