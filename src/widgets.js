// -----------------------------------------------------------------------------
// The "Air quality" dashboard widget (Gladys 5.1+).
//
// With an area chosen in its settings: live tiles of its pollutant indices
// (bound to the device features, so they follow every state), the DAQI band
// colored, and the age of the bulletin. Without one: one row per added
// borough or site, its band colored.
//
// The content is built from what the integration already read: showing the
// widget never calls the API. The core caches it per (settings, language,
// units), so the texts are localized in the language it asks for.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FORMULAS, MESSAGES, TEXT, bandLabel } from './i18n.js';
import { idsOf, pollutantsOf } from './devices.js';
import { LANGUAGES } from './config.js';

export const WIDGET_KEY = 'air_quality';

/** Seconds the core keeps a content: the data move hourly. */
const TTL_SECONDS = 300;

/** Tiles of the single-area view, 4 at most, the first measured ones. */
const MAX_TILES = 4;

/** Rows of the all-areas view. */
const MAX_ROWS = 10;

/** Color of a DAQI band rank: Low green, Moderate orange, High and Very high red. */
export function bandColor(rank) {
  if (rank === 0) {
    return WIDGET_COLORS.SUCCESS;
  }
  return rank === 1 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.DANGER;
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The band row of an area: its label and color, neutral when stale. */
function bandItem(hub, record, label, language) {
  const minutes = hub.ageMinutes(record);
  if (minutes === null) {
    return { label, value: TEXT.noData[language], color: WIDGET_COLORS.NEUTRAL };
  }
  if (hub.isStale(record)) {
    const value = MESSAGES.measuredAgo(minutes, true)[language];
    return { label, value: clip(value, 40), color: WIDGET_COLORS.NEUTRAL, icon: 'clock' };
  }
  const index = hub.indexOf(record);
  if (!index) {
    return { label, value: TEXT.noData[language], color: WIDGET_COLORS.NEUTRAL };
  }
  return { label, value: bandLabel(index.level, language), color: bandColor(index.rank) };
}

/**
 * The widget content.
 * @param {object} options
 * @param {import('./hub.js').Hub} options.hub
 * @param {object} options.gladys
 * @param {{ area?: string }} [options.settings]
 * @param {string} [options.language]
 */
export function buildAirQualityContent({ hub, gladys, settings = {}, language = 'en' }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const caption = { type: 'text', variant: 'caption', text: TEXT.source[lang] };

  if (settings.area) {
    const record = hub.recordByDevice(settings.area);
    if (!record) {
      return {
        ttl_seconds: TTL_SECONDS,
        components: [{ type: 'text', text: TEXT.unknownArea[lang] }],
      };
    }
    const ids = idsOf(gladys, record.id);
    const tiles = pollutantsOf(record)
      .slice(0, MAX_TILES)
      .map((key) => ({ type: 'value', label: FORMULAS[key], device_feature: ids.feature(key) }));
    const minutes = hub.ageMinutes(record);
    const items = [bandItem(hub, record, TEXT.airQuality[lang], lang)];
    if (minutes !== null && !hub.isStale(record)) {
      items.push({
        label: TEXT.measured[lang],
        value: clip(MESSAGES.measuredAgo(minutes, false)[lang], 40),
        color: WIDGET_COLORS.NEUTRAL,
        icon: 'clock',
      });
    }
    return {
      ttl_seconds: TTL_SECONDS,
      components: [...tiles, { type: 'status', items }, caption],
    };
  }

  const created = hub.configuredRecords().filter((record) => hub.isCreated(record));
  if (created.length === 0) {
    return {
      ttl_seconds: TTL_SECONDS,
      components: [{ type: 'text', text: TEXT.noArea[lang] }],
    };
  }
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'status',
        items: created
          .slice(0, MAX_ROWS)
          .map((record) => bandItem(hub, record, clip(hub.nameOf(record), 40), lang)),
      },
      caption,
    ],
  };
}
