// -----------------------------------------------------------------------------
// The integration end to end, on the SDK's fake Gladys and the real London Air
// bulletin: discovery, states, freshness, the container's own polling, the
// scene triggers, the status of the Configuration screen.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered, featureId } from './helpers/world.js';
import {
  BARNET,
  CAMDEN,
  LEWISHAM,
  MARYLEBONE,
  NORBURY,
  WESTMINSTER,
  bulletinAt,
} from './helpers/network.js';
import { MemoryStore } from '../src/store.js';
import { TEXT } from '../src/i18n.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const BOROUGHS = [WESTMINSTER, LEWISHAM, CAMDEN].join(', ');
const SITES = [MARYLEBONE, NORBURY].join(' ');
const ALL = { boroughs: BOROUGHS, sites: SITES };
const keys = (device) => device.features.map((f) => f.external_id.split(':').pop());

test('one device per borough and per site, with the pollutants it measures', async () => {
  const w = await createWorld({ config: ALL });
  assert.equal(w.gladys.fake.discoveredDevices.length, 5);
  const westminster = discovered(w, '33');
  assert.equal(westminster.name, 'London Air Westminster');
  assert.equal(westminster.model, 'London Air borough');
  assert.equal(westminster.external_id, 'ext:test-integration:borough:33');
  assert.deepEqual(keys(westminster), ['index', 'band', 'pm25', 'pm10', 'no2', 'o3', 'so2', 'age']);
  assert.equal(westminster.should_poll, false);
  assert.equal(westminster.features[0].name, "Indice de qualité de l'air (DAQI)");
  // Lewisham: one site, a lone object in the JSON.
  assert.equal(discovered(w, LEWISHAM).name, 'London Air Lewisham');
  assert.deepEqual(keys(discovered(w, LEWISHAM)), [
    'index',
    'band',
    'pm25',
    'pm10',
    'no2',
    'o3',
    'age',
  ]);
  // A site: its own name; Norbury measures NO₂ only (a lone object too).
  const marylebone = discovered(w, MARYLEBONE);
  assert.equal(marylebone.name, 'London Air Westminster - Marylebone Road');
  assert.equal(marylebone.model, 'London Air site MY1');
  assert.deepEqual(keys(marylebone), ['index', 'band', 'no2', 'o3', 'so2', 'age']);
  assert.deepEqual(keys(discovered(w, NORBURY)), ['index', 'band', 'no2', 'age']);
  // Camden: every pollutant "No data", still a device with what it measures.
  assert.equal(discovered(w, '6').features.length, 8);
  // Nothing is published for a device not added to Gladys.
  assert.deepEqual(w.gladys.fake.states, []);
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
  // One request for all of them.
  assert.deepEqual(w.network.calls, ['/Hourly/MonitoringIndex/GroupName=London/Json']);
});

test('the states of an added area: worst index, its band, pollutant indices, age', async () => {
  const w = await createWorld({ config: ALL });
  await createAll(w);
  const last = (area, key) => w.gladys.fake.lastState(featureId(w, area, key));
  // Westminster: the worst of its five sites, pollutant by pollutant.
  assert.equal(last('33', 'index'), 2);
  assert.equal(last('33', 'band'), 'Faible');
  assert.equal(last('33', 'o3'), 2);
  assert.equal(last('33', 'pm25'), 1);
  assert.equal(last('33', 'so2'), undefined, '"No data" is not a value');
  assert.equal(last('33', 'age'), 20);
  assert.equal(last(MARYLEBONE, 'index'), 2);
  assert.equal(last(MARYLEBONE, 'no2'), undefined);
  assert.equal(last(NORBURY, 'no2'), 1);
  // Camden: no data, no index; the age still says how old the bulletin is.
  assert.equal(last('6', 'index'), undefined);
  assert.equal(last('6', 'age'), 20);
  assert.ok(w.gladys.fake.widgetRefreshes.includes('air_quality'));
});

test('a device added again gets every state again, even unchanged', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  await createAll(w);
  const before = w.gladys.fake.states.length;
  await w.gladys.fake.deviceCreated(discovered(w, MARYLEBONE));
  assert.equal(w.gladys.fake.states.length - before, 4, 'index, band, O₃, age');
});

test('an old bulletin is never published as current', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  w.advance(7 * HOUR); // London Air stuck on 08:00: 7 h 20 old
  await createAll(w);
  const last = (key) => w.gladys.fake.lastState(featureId(w, MARYLEBONE, key));
  assert.equal(last('index'), undefined);
  assert.equal(last('o3'), undefined);
  assert.equal(last('age'), 440);
});

test('the bulletin date is UK time, summer or winter', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  w.clock.now = Date.parse('2026-12-01T09:10:00Z');
  w.network.index = bulletinAt('2026-12-01 09:00:00'); // GMT: 09:00 UTC
  await createAll(w);
  assert.equal(w.gladys.fake.lastState(featureId(w, MARYLEBONE, 'age')), 10);
});

test('the container reads the bulletin on its own timer, once for every area', async () => {
  const w = await createWorld({ config: ALL });
  await createAll(w);
  const before = w.network.calls.length;
  // Within the period: nothing read again.
  w.advance(20 * MINUTE);
  await w.app.poller.cycle();
  assert.equal(w.network.calls.length, before);
  // Past 90 % of it: one request, every area updated.
  w.advance(10 * MINUTE);
  w.network.index = bulletinAt('2026-10-24 08:00:00', { CR5: { NO2: 3 } });
  await w.app.poller.cycle();
  assert.equal(w.network.calls.length, before + 1);
  assert.equal(w.gladys.fake.lastState(featureId(w, NORBURY, 'no2')), 3);
  assert.equal(w.gladys.fake.lastState(featureId(w, NORBURY, 'age')), 50);
});

test('nothing added, everything known: the timer does not read', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  w.advance(2 * HOUR);
  await w.app.poller.cycle();
  assert.equal(w.network.calls.length, 1);
});

test('onPoll, should the core call it, reads only when due', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  await createAll(w);
  const before = w.network.calls.length;
  await w.gladys.fake.poll(discovered(w, MARYLEBONE));
  assert.equal(w.network.calls.length, before);
  w.advance(HOUR);
  await w.gladys.fake.poll(discovered(w, MARYLEBONE));
  assert.equal(w.network.calls.length, before + 1);
});

test('scene triggers: moderate, worse, better but still degraded, back to low', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE, language: 'en' } });
  await createAll(w);
  const step = async (hour, o3) => {
    w.network.index = bulletinAt(`2026-10-24 ${hour}:00:00`, { MY1: { O3: o3 } });
    w.advance(HOUR);
    await w.app.poller.cycle();
  };
  await step('09', 3); // still low: nothing
  await step('10', 5); // moderate
  await step('11', 6); // same band: nothing
  await step('12', 7); // high
  await step('13', 4); // moderate again: nothing
  await step('14', 2); // low
  const events = w.gladys.fake.sceneEvents;
  assert.deepEqual(
    events.map((event) => [event.key, event.data.band, event.data.index]),
    [
      ['air_quality_degraded', 'moderate', 5],
      ['air_quality_degraded', 'high', 7],
      ['air_quality_back_to_normal', 'low', 2],
    ],
  );
  assert.deepEqual(events[0].data, {
    area: 'ext:test-integration:site:my1',
    area_name: 'London Air Westminster - Marylebone Road',
    band: 'moderate',
    band_label: 'Moderate',
    index: 5,
    previous_band: 'low',
    previous_index: 3,
    pollutant: 'O₃',
    summary: 'London Air Westminster - Marylebone Road: Moderate (5) · O₃ 5',
  });
  assert.equal(events[2].data.worst_band, 'high');
  assert.equal(events[2].data.worst_band_label, 'High (7)');
  assert.equal(events[2].data.worst_index, 7);
});

test('no event for an area not added, nor twice after a restart', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ config: { sites: MARYLEBONE }, store });
  w.network.index = bulletinAt('2026-10-24 08:00:00', { MY1: { O3: 5 } });
  await w.app.poller.refreshNow();
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  await w.app.stop();

  // Restarted, the device now added: the same index is not news.
  const again = await createWorld({
    config: { sites: MARYLEBONE },
    store,
    devices: w.gladys.fake.discoveredDevices,
    setup: (network) => {
      network.index = bulletinAt('2026-10-24 08:00:00', { MY1: { O3: 5 } });
    },
  });
  assert.equal(again.gladys.fake.lastState(featureId(again, MARYLEBONE, 'index')), 5);
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
  // The device names and pollutants come back from /data, before any read.
  const offline = await createWorld({
    config: { sites: MARYLEBONE },
    store,
    setup: (network) => {
      network.down = true;
    },
  });
  assert.equal(discovered(offline, MARYLEBONE).features.length, 6);
});

test('a borough typed by name comes back from /data while the API is down', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ config: { boroughs: WESTMINSTER }, store });
  await w.app.stop();
  const offline = await createWorld({
    config: { boroughs: WESTMINSTER },
    store,
    setup: (network) => {
      network.down = true;
    },
  });
  assert.equal(discovered(offline, '33').name, 'London Air Westminster');
});

test('the status: nothing configured, API down and back', async () => {
  const empty = await createWorld();
  assert.deepEqual(empty.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.notConfigured,
  });

  const w = await createWorld({ config: { sites: MARYLEBONE } });
  await createAll(w);
  w.network.down = true;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.apiUnreachable,
  });
  w.network.down = false;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('a borough without site, an unknown name or code: no device, and the check says why', async () => {
  const w = await createWorld({
    config: { boroughs: `${BARNET}, Paris, kensington & chelsea`, sites: 'ZZ9, a-b' },
  });
  assert.deepEqual(
    w.gladys.fake.discoveredDevices.map((device) => device.name),
    ['London Air Kensington and Chelsea'],
  );
  const { data } = await w.gladys.fake.action('check_areas', {});
  const lines = data.message.en.split('\n');
  assert.deepEqual(lines.slice(0, 1), [
    'London Air Barnet (2): no monitoring site in this borough now, choose a site nearby',
  ]);
  assert.match(lines[1], /^London Air Kensington and Chelsea \(20\): Low \(\d+\), /);
  assert.equal(lines[2], 'ZZ9: not in the London Air bulletin (see "Find an area")');
  assert.equal(lines[3], 'Not London Air boroughs: Paris');
  assert.equal(lines[4], 'Ignored, not site codes: a-b');
});

test('a borough name typed loosely: "Kingston upon Thames" is "Kingston"', async () => {
  const w = await createWorld({ config: { boroughs: 'kingston upon thames, 33' } });
  assert.deepEqual(w.app.hub.units(), ['borough:21', 'borough:33']);
});

test('ten areas at most', async () => {
  const w = await createWorld({
    config: { sites: 'BG1 BG2 BQ7 BQ9 BX1 BX2 BT4 BT5 BT6 BT8 CR5 CR7' },
  });
  assert.equal(w.gladys.fake.discoveredDevices.length, 10);
  const { data } = await w.gladys.fake.action('check_areas', {});
  assert.match(data.message.fr, /Seuls les 10 premiers arrondissements et sites sont lus\.$/);
});

test('a device added days after the configuration fires nothing at once', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  // Read once for the Discovery tab (low), then not read while not added.
  w.advance(48 * HOUR);
  w.network.index = bulletinAt('2026-10-26 07:00:00', { MY1: { O3: 6 } });
  await createAll(w);
  assert.equal(w.gladys.fake.lastState(featureId(w, MARYLEBONE, 'index')), 6);
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  // From there, a change does fire.
  w.network.index = bulletinAt('2026-10-26 08:00:00', { MY1: { O3: 8 } });
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((event) => event.data.band),
    ['high'],
  );
});

test('an event Gladys refused is sent at the next cycle, an event sent is not sent again', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ config: { sites: MARYLEBONE }, store });
  await createAll(w);
  const publish = w.gladys.publishSceneEvent.bind(w.gladys);
  let refuse = true;
  w.gladys.publishSceneEvent = async (...args) => {
    if (refuse) {
      refuse = false;
      throw new Error('HTTP 429');
    }
    return publish(...args);
  };
  w.network.index = bulletinAt('2026-10-24 09:00:00', { MY1: { O3: 4 } });
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((event) => event.key),
    ['air_quality_degraded'],
  );
  await w.app.stop();

  // Restarted on the same /data, the same bulletin: nothing new.
  const again = await createWorld({
    config: { sites: MARYLEBONE },
    store,
    devices: w.gladys.fake.discoveredDevices,
    setup: (network) => {
      network.index = bulletinAt('2026-10-24 09:00:00', { MY1: { O3: 4 } });
    },
  });
  again.advance(2 * HOUR);
  await again.app.poller.refreshNow();
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
});

test('an odd answer keeps the last values and says the API is failing', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE } });
  await createAll(w);
  w.network.index = { unexpected: true };
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus.message, TEXT.apiUnreachable);
  assert.equal(w.gladys.fake.lastState(featureId(w, MARYLEBONE, 'index')), 2);
});

test('a pollutant gone "No data" for an hour neither improves nor degrades the band', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE, language: 'en' } });
  await createAll(w);
  const step = async (hour, o3) => {
    w.network.index = bulletinAt(`2026-10-24 ${hour}:00:00`, { MY1: { O3: o3 } });
    w.advance(HOUR);
    await w.app.poller.cycle();
  };
  await step('09', 5); // moderate
  await step('10', 0); // O₃ "No data": the last value holds
  await step('11', 5);
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((event) => event.key),
    ['air_quality_degraded'],
  );
  assert.equal(w.gladys.fake.lastState(featureId(w, MARYLEBONE, 'index')), 5);
  // Past 3 h without data, the value is dropped.
  await step('12', 0);
  await step('13', 0);
  await step('14', 0);
  await step('15', 0);
  assert.equal(w.app.hub.indexOf(w.app.hub.records.get('site:MY1')), null);
});

test('a long night without data still ends the episode with an event', async () => {
  const w = await createWorld({ config: { sites: MARYLEBONE, language: 'en' } });
  await createAll(w);
  w.network.index = bulletinAt('2026-10-24 09:00:00', { MY1: { O3: 5 } });
  w.advance(HOUR);
  await w.app.poller.cycle();
  for (let hour = 10; hour < 20; hour += 1) {
    w.network.index = bulletinAt(`2026-10-24 ${hour}:00:00`, { MY1: { O3: 0 } });
    w.advance(HOUR);
    await w.app.poller.cycle();
  }
  w.network.index = bulletinAt('2026-10-24 20:00:00', { MY1: { O3: 2 } });
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((event) => event.key),
    ['air_quality_degraded', 'air_quality_back_to_normal'],
  );
});

test('a borough missing from one answer keeps its device and its name', async () => {
  const w = await createWorld({ config: { boroughs: WESTMINSTER } });
  await createAll(w);
  const partial = bulletinAt('2026-10-24 08:00:00');
  partial.HourlyAirQualityIndex.LocalAuthority =
    partial.HourlyAirQualityIndex.LocalAuthority.filter(
      (authority) => authority['@LocalAuthorityCode'] !== '33',
    );
  w.network.index = partial;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.app.hub.units(), ['borough:33']);
  assert.equal(discovered(w, '33').name, 'London Air Westminster');
});
