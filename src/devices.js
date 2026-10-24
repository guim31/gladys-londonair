// -----------------------------------------------------------------------------
// The Gladys devices: one per London borough, one per monitoring site.
//
// External ids (forever, see CLAUDE.md):
//   ext:<selector>:borough:<London Air borough number>
//   ext:<selector>:site:<London Air site code, lower case>
//   features :index, :band, :no2, :o3, :pm10, :pm25, :so2, :age
//
// Features:
//   - index : the UK Daily Air Quality Index (DAQI), `airquality-sensor/aqi`,
//             1 (low) to 10 (very high): the highest pollutant index of the
//             site, or of every site of the borough. No state while London
//             Air has no data;
//   - band  : the DAQI band as a word (Low, Moderate, High, Very high), in
//             the configured language (text/text);
//   - one index per pollutant the site (or the borough) measures, on the same
//             1 to 10 scale. London Air publishes indices, not concentrations,
//             in its hourly bulletin: they are `airquality-sensor/aqi` too;
//   - age   : minutes since the hour of the bulletin.
//
// The pollutants are learnt from the bulletins, kept under /data, and never
// removed: a feature is an external id Gladys keeps.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';

/** The pollutants, in display order (particles first, as on londonair.org.uk). */
export const POLLUTANTS = ['pm25', 'pm10', 'no2', 'o3', 'so2'];

export const INDEX_KEY = 'index';
export const BAND_KEY = 'band';
export const AGE_KEY = 'age';

/** Device types, in the external ids. */
export const KIND = { BOROUGH: 'borough', SITE: 'site' };

const daqiShape = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  unit: UNITS.AQI,
  min: 0,
  max: 10,
  keep_history: true,
};

// min/max are display bounds (Gladys never clamps a state with them).
const SHAPES = {
  index: daqiShape,
  band: {
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    keep_history: false,
  },
  ...Object.fromEntries(POLLUTANTS.map((key) => [key, daqiShape])),
  // A week on the scale; an older bulletin still gets its real age.
  age: {
    category: CATEGORIES.DURATION,
    type: TYPES.DURATION.INTEGER,
    unit: UNITS.MINUTES,
    min: 0,
    max: 10080,
    keep_history: false,
  },
};

/** The key of an area: "borough:7" or "site:CD1". */
export function areaKey(kind, code) {
  return `${kind}:${kind === KIND.SITE ? String(code).toUpperCase() : String(code)}`;
}

/** Kind and code of an area key. */
export function parseAreaKey(key) {
  const [kind, code] = String(key).split(':');
  return { kind, code };
}

/**
 * The external ids of an area.
 * @param {object} gladys
 * @param {string} key area key
 */
export function idsOf(gladys, key) {
  const { kind, code } = parseAreaKey(key);
  return gladys.externalIds(kind, code.toLowerCase());
}

/** The area key of a device (or feature) external id, or null. */
export function areaKeyOf(externalId) {
  const match = /:(borough|site):([a-z0-9]+)(?::[a-z0-9]+)?$/.exec(String(externalId ?? ''));
  return match ? areaKey(match[1], match[2]) : null;
}

/** The device name: the network and the borough or site, never translated. */
export function deviceName(record) {
  const { code } = parseAreaKey(record.id);
  return `London Air ${record.name || code}`;
}

/** The pollutants of a record, in display order. */
export function pollutantsOf(record) {
  return POLLUTANTS.filter((key) => (record.pollutants ?? []).includes(key));
}

/**
 * The discovery payload of an area.
 * @param {object} gladys
 * @param {{ id: string, name?: string, pollutants?: string[] }} record
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, record, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = idsOf(gladys, record.id);
  const { kind, code } = parseAreaKey(record.id);
  const feature = (key) => ({
    name: names[key],
    external_id: ids.feature(key),
    ...SHAPES[key],
    read_only: true,
    has_feedback: false,
  });
  return {
    name: deviceName(record),
    external_id: ids.device,
    model: kind === KIND.SITE ? `London Air site ${code}` : 'London Air borough',
    // London Air publishes hourly: the container reads the bulletin on its
    // own timer (src/poller.js), well beyond the 60 s the core can schedule.
    should_poll: false,
    features: [
      feature(INDEX_KEY),
      feature(BAND_KEY),
      ...pollutantsOf(record).map(feature),
      feature(AGE_KEY),
    ],
    params: [{ name: kind === KIND.SITE ? 'site_code' : 'borough_number', value: code }],
  };
}
