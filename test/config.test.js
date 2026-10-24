import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  parseBoroughs,
  parseSiteCodes,
  periodMs,
} from '../src/config.js';

test('the defaults read nothing, every 30 minutes, in French', () => {
  const config = normalizeConfig();
  assert.deepEqual(config.boroughs, []);
  assert.deepEqual(config.siteCodes, []);
  assert.equal(config.refreshMinutes, 30);
  assert.equal(config.language, 'fr');
  assert.equal(DEFAULT_CONFIG.language, 'fr');
  assert.equal(periodMs(config), 1_800_000);
});

test('boroughs: commas or semicolons, names with spaces, duplicates dropped', () => {
  assert.deepEqual(parseBoroughs(' Camden;  City of  London, camden, #33,, '), [
    'Camden',
    'City of London',
    '33',
  ]);
});

test('site codes: upper-cased, spaces or commas, the odd ones reported', () => {
  assert.deepEqual(parseSiteCodes('my1, CD1 my1;bl0 a-b X'), {
    valid: ['MY1', 'CD1', 'BL0'],
    invalid: ['a-b', 'X'],
  });
});

test('unknown refresh or language: the defaults', () => {
  const config = normalizeConfig({ refresh_minutes: '5', language: 'it' });
  assert.equal(config.refreshMinutes, 30);
  assert.equal(config.language, 'fr');
  assert.equal(normalizeConfig({ refresh_minutes: '60' }).refreshMinutes, 60);
});
