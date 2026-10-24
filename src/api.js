// -----------------------------------------------------------------------------
// The London Air Quality Network API (https://api.erg.ic.ac.uk/AirQuality/),
// open, without key, run by the Environmental Research Group of Imperial
// College London.
//
// One request gives everything the integration needs: the hourly index of
// every London borough, every monitoring site in it (name, coordinates) and
// every pollutant the site measures, with its index on the UK Daily Air
// Quality Index scale (DAQI, 1 to 10).
//
// The JSON is converted from XML: attributes are "@..." strings, and a list
// with a single element is a lone object (a borough with one site, a site
// with one pollutant), a list with none is absent. This module is the only
// place that knows it, and returns neutral objects to the rest of the code.
// -----------------------------------------------------------------------------

import { parseLondonTime } from './time.js';

export const API_URL = 'https://api.erg.ic.ac.uk/AirQuality';

export const INDEX_PATH = '/Hourly/MonitoringIndex/GroupName=London/Json';

const TIMEOUT_MS = 20_000;

const USER_AGENT = 'gladys-londonair (+https://github.com/guim31/gladys-londonair)';

/** The pollutants of the DAQI, by London Air species code, and our keys. */
export const POLLUTANT_BY_CODE = {
  NO2: 'no2',
  O3: 'o3',
  PM10: 'pm10',
  PM25: 'pm25',
  SO2: 'so2',
};

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, unreachable?: boolean }} [details]
   */
  constructor(message, { status, unreachable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    /** No answer at all (DNS, network, timeout). */
    this.unreachable = unreachable;
  }
}

/** A list from XML-converted JSON: absent -> [], a lone object -> [it]. */
export function asList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object');
  }
  return value && typeof value === 'object' ? [value] : [];
}

const toNumber = (value) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};

/** A DAQI value, 1 to 10, or null ("No data" is 0). */
export function daqi(value) {
  const number = toNumber(value);
  return Number.isInteger(number) && number >= 1 && number <= 10 ? number : null;
}

/**
 * GET a path of the API, as JSON.
 * @param {string} path
 * @param {{ fetch?: typeof fetch }} [deps]
 */
async function getJson(path, { fetch: fetchImpl = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${API_URL}${path}`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.message;
    throw new ApiError(`London Air API unreachable (${reason})`, { unreachable: true });
  }
  if (!response.ok) {
    throw new ApiError(`London Air API: HTTP ${response.status}`, { status: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError('London Air API: unreadable answer', { status: response.status });
  }
}

/**
 * One site of the index.
 * @returns {{ code: string, name: string, type: string, lat: number|null, lon: number|null, at: number|null, species: Record<string, number|null> }}
 */
function parseSite(site) {
  const species = {};
  for (const item of asList(site.Species)) {
    const key = POLLUTANT_BY_CODE[String(item['@SpeciesCode'] ?? '').toUpperCase()];
    if (key) {
      // A pollutant listed twice keeps its highest index.
      const value = daqi(item['@AirQualityIndex']);
      species[key] = Math.max(species[key] ?? 0, value ?? 0) || null;
    }
  }
  return {
    code: String(site['@SiteCode']).trim().toUpperCase(),
    name: String(site['@SiteName'] ?? site['@SiteCode']).trim(),
    type: String(site['@SiteType'] ?? '').trim(),
    lat: toNumber(site['@Latitude']),
    lon: toNumber(site['@Longitude']),
    at: parseLondonTime(site['@BulletinDate']),
    species,
  };
}

/**
 * The hourly index of every London borough and site.
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {Promise<Array<{ code: string, name: string, lat: number|null, lon: number|null, sites: ReturnType<typeof parseSite>[] }>>}
 */
export async function fetchIndex(deps) {
  const body = await getJson(INDEX_PATH, deps);
  const root = body?.HourlyAirQualityIndex;
  if (!root || typeof root !== 'object') {
    throw new ApiError('London Air API: no index in the answer');
  }
  const boroughs = [];
  for (const authority of asList(root.LocalAuthority)) {
    const code = toNumber(authority['@LocalAuthorityCode']);
    if (!Number.isInteger(code) || code <= 0) {
      continue;
    }
    boroughs.push({
      code: String(code),
      name: String(authority['@LocalAuthorityName'] ?? `#${code}`).trim(),
      lat: toNumber(authority['@LaCentreLatitude']),
      lon: toNumber(authority['@LaCentreLongitude']),
      sites: asList(authority.Site)
        .filter((site) => /^[A-Za-z0-9]{2,8}$/.test(String(site['@SiteCode'] ?? '').trim()))
        .map(parseSite),
    });
  }
  if (boroughs.length === 0) {
    throw new ApiError('London Air API: no borough in the answer');
  }
  return boroughs;
}
