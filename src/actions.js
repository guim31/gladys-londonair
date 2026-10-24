// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   find_area   : the boroughs and sites matching a name, or the nearest to a
//                 house of Gladys (its location, `location: true` in the
//                 manifest), to type in "Boroughs" or "Sites".
//   check_areas : what each configured borough and site gives right now.
// -----------------------------------------------------------------------------

import { searchAreas } from './catalog.js';
import { MAX_AREAS } from './config.js';
import { deviceName, parseAreaKey, pollutantsOf } from './devices.js';
import { MESSAGES, TEXT } from './i18n.js';

export const ACTION = {
  FIND_AREA: 'find_area',
  CHECK_AREAS: 'check_areas',
};

/** The search lists this many boroughs, and as many sites, at most. */
const MAX_LISTED = 5;

/**
 * @param {object} gladys
 * @param {import('./hub.js').Hub} hub
 * @param {ReturnType<import('./poller.js').createPoller>} poller
 * @param {{ query?: string, house?: string }} fields
 */
export async function findArea(gladys, hub, poller, fields) {
  const query = String(fields.query ?? '').trim();
  let origin;
  let houseName;
  if (fields.house || !query) {
    const houses = (await gladys.getHouses()).filter(
      (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
    );
    const house = fields.house
      ? houses.find((candidate) => candidate.selector === fields.house)
      : houses[0];
    if (!house && !query) {
      throw new Error(MESSAGES.thrown(TEXT.noHouse));
    }
    if (house) {
      origin = { lat: house.latitude, lon: house.longitude };
      houseName = house.name;
    }
  }
  // The list comes with the bulletin: read it when there is none, or an old one.
  if (hub.now() - hub.catalog.fetchedAt > 24 * 60 * 60_000) {
    await poller.refreshNow({ maxAgeMs: 60_000 });
  }
  if (hub.catalog.boroughs.length === 0) {
    throw new Error(MESSAGES.thrown(TEXT.catalogUnavailable));
  }
  const { boroughs, sites } = searchAreas(hub.catalog, { query, origin });
  const more = Math.max(0, boroughs.length - MAX_LISTED) + Math.max(0, sites.length - MAX_LISTED);
  return MESSAGES.found({
    query,
    house: houseName,
    boroughs: boroughs.slice(0, MAX_LISTED),
    sites: sites.slice(0, MAX_LISTED),
    more,
  });
}

/**
 * Read the bulletin (unless read in the last minute) and report each area.
 * @param {import('./hub.js').Hub} hub
 * @param {ReturnType<import('./poller.js').createPoller>} poller
 * @param {object} config the normalized config
 */
export async function checkAreas(hub, poller, config) {
  if (config.boroughs.length === 0 && config.siteCodes.length === 0) {
    return TEXT.nothingConfigured;
  }
  await poller.refreshNow({ maxAgeMs: 60_000 });
  const lines = hub.units(config).map((key) => {
    const record = hub.records.get(key);
    const result = hub.lastResults.get(key);
    const { code } = parseAreaKey(key);
    return MESSAGES.checkArea({
      head: record?.name ? `${deviceName(record)} (${code})` : code,
      level: hub.indexOf(record)?.level ?? null,
      minutes: hub.ageMinutes(record),
      pollutants: record ? pollutantsOf(record) : [],
      error: result && !result.ok && !result.missing ? result.error : null,
      missing: result?.missing === true,
    });
  });
  const unknown = hub.unknownBoroughs(config);
  if (unknown.length > 0) {
    lines.push(MESSAGES.unknownBoroughs(unknown));
  }
  if (config.invalidSites.length > 0) {
    lines.push(MESSAGES.invalidSites(config.invalidSites));
  }
  if (hub.allUnits(config).length > MAX_AREAS) {
    lines.push(MESSAGES.tooMany(MAX_AREAS));
  }
  if (lines.length === 0) {
    return TEXT.catalogUnavailable;
  }
  return Object.fromEntries(
    Object.keys(lines[0]).map((lang) => [lang, lines.map((line) => line[lang]).join('\n')]),
  );
}
