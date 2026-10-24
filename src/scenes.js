// -----------------------------------------------------------------------------
// Scene action "Get the air quality" (Gladys 5.1+).
//
// Gives a scene the air quality of one borough or site, or of the worst of the
// added ones, as outputs a notification can quote: "{{...summary}}" reads
// "London Air Camden: Moderate (4) · PM2.5 4 · NO₂ 2".
// The devices already give each value to the scene conditions; what this
// action adds is the choice of the worst area, the band as a word in the
// configured language, and a ready-made sentence.
//
// The triggers are fired by the hub (src/hub.js) on each new bulletin.
// -----------------------------------------------------------------------------

import { BANDS, MESSAGES, TEXT } from './i18n.js';

export const GET_AIR_QUALITY = 'get_air_quality';

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ area?: string }} fields
 * @param {string} language
 */
export function getAirQuality(hub, fields, language) {
  const created = hub.configuredRecords().filter((record) => hub.isCreated(record));
  let record;
  if (fields.area) {
    record = created.find((candidate) => candidate === hub.recordByDevice(fields.area));
  } else {
    // The worst current index; the first configured area on a tie.
    record = created
      .filter((candidate) => hub.indexOf(candidate))
      .sort((a, b) => hub.indexOf(b).level - hub.indexOf(a).level)[0];
  }
  if (!record || hub.isStale(record)) {
    throw new Error(MESSAGES.thrown(TEXT.noReading));
  }
  const index = hub.indexOf(record);
  const values = hub.valuesOf(record);
  const outputs = {
    area_name: hub.nameOf(record),
    band: index?.key ?? null,
    band_label: index ? BANDS[index.key][language] : TEXT.noData[language],
    index: index?.level ?? null,
    pollutant: hub.criticalPollutants(record) || null,
    pm25: values.pm25 ?? null,
    pm10: values.pm10 ?? null,
    no2: values.no2 ?? null,
    o3: values.o3 ?? null,
    so2: values.so2 ?? null,
    age_minutes: hub.ageMinutes(record),
    summary: hub.summary(record, language),
  };
  // What the area does not measure is left out (null for the scene).
  return Object.fromEntries(Object.entries(outputs).filter(([, value]) => value !== null));
}
