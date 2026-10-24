// -----------------------------------------------------------------------------
// A simulated London Air API, answering with the real hourly bulletin recorded
// on 2026-10-24 (08:00 BST, test/fixtures/londonair/index.json): 33 boroughs,
// 12 of them without site, sites and pollutants as lone objects or lists, many
// pollutants still "No data" early in the morning. Tests never touch the
// real network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

/** The recorded bulletin, parsed (a fresh copy each time). */
export function bulletin() {
  return JSON.parse(
    readFileSync(new URL('../fixtures/londonair/index.json', import.meta.url), 'utf8'),
  );
}

/** The areas of the tests. */
export const WESTMINSTER = 'Westminster'; // borough 33, five sites, worst index 2 (O₃ at MY1)
export const LEWISHAM = '23'; // borough with a single site (a lone object), index 1
export const CAMDEN = 'Camden'; // borough 6, two sites, every pollutant "No data"
export const BARNET = 'Barnet'; // borough 2, no site in the bulletin
export const MARYLEBONE = 'MY1'; // site, Westminster - Marylebone Road
export const NORBURY = 'CR5'; // site measuring a single pollutant (a lone object)

/** Every site of a bulletin, with its borough. */
function sitesOf(body) {
  const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  return list(body.HourlyAirQualityIndex.LocalAuthority).flatMap((authority) =>
    list(authority.Site).map((site) => ({ authority, site, species: list(site.Species) })),
  );
}

/**
 * The bulletin at another hour, with some indices changed:
 * `bulletinAt('2026-10-24 09:00:00', { MY1: { O3: 5 } })`.
 */
export function bulletinAt(date, changes = {}) {
  const body = bulletin();
  for (const { site, species } of sitesOf(body)) {
    site['@BulletinDate'] = date;
    for (const item of species) {
      const value = changes[site['@SiteCode']]?.[item['@SpeciesCode']];
      if (value !== undefined) {
        item['@AirQualityIndex'] = String(value);
        item['@AirQualityBand'] =
          value === 0 ? 'No data' : value <= 3 ? 'Low' : value <= 6 ? 'Moderate' : 'High';
      }
    }
  }
  return body;
}

/**
 * @param {object} [options]
 * @param {() => number} [options.now] the clock passed to a route function
 */
export function createNetwork({ now = () => Date.now() } = {}) {
  const calls = [];
  const network = {
    calls,
    /** The answer: a body, a function (now) => body, an Error, or { status }. */
    index: null,
    /** The whole API unreachable. */
    down: false,
    fetch,
  };

  async function fetch(href) {
    const path = String(href).replace('https://api.erg.ic.ac.uk/AirQuality', '');
    calls.push(path);
    if (network.down) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    if (path !== '/Hourly/MonitoringIndex/GroupName=London/Json') {
      return new Response('not found', { status: 404 });
    }
    const value = typeof network.index === 'function' ? network.index(now()) : network.index;
    if (value instanceof Error) {
      throw value;
    }
    if (value && Object.keys(value).length === 1 && value.status) {
      return new Response('<html>error</html>', { status: value.status });
    }
    return new Response(JSON.stringify(value ?? bulletin()), {
      headers: { 'content-type': 'application/json' },
    });
  }

  return network;
}
