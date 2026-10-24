// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed with spaces, or invalid values.
//
// Boroughs are typed by name or number ("Camden, 33"): the names are resolved
// against the London Air list by the hub (src/hub.js), once it is known.
// Sites are typed by their London Air code ("CD1, MY1").
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, the ones every text carries. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The refresh intervals offered, in minutes (London Air publishes hourly). */
export const REFRESH_MINUTES = ['30', '60'];

/** At most this many boroughs and sites, together, become devices. */
export const MAX_AREAS = 10;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  boroughs: '', // borough names or numbers, e.g. "Camden, Westminster"
  sites: '', // site codes, e.g. "CD1, MY1"
  refresh_minutes: '30', // how often the index is read
  language: 'fr', // language of the feature names and of the generated texts
};

/**
 * Merge the user config with the defaults and normalize every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const sites = parseSiteCodes(raw.sites ?? DEFAULT_CONFIG.sites);
  const refresh = String(raw.refresh_minutes ?? DEFAULT_CONFIG.refresh_minutes).trim();
  const language = String(raw.language ?? DEFAULT_CONFIG.language).trim();
  return {
    boroughs: parseBoroughs(raw.boroughs ?? DEFAULT_CONFIG.boroughs),
    siteCodes: sites.valid,
    invalidSites: sites.invalid,
    refreshMinutes: REFRESH_MINUTES.includes(refresh)
      ? Number(refresh)
      : Number(DEFAULT_CONFIG.refresh_minutes),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/**
 * Split a typed list of boroughs (names or numbers). Commas and semicolons
 * separate them (names hold spaces); duplicates are dropped, order kept.
 * @param {unknown} text
 * @returns {string[]}
 */
export function parseBoroughs(text) {
  const out = [];
  for (const token of String(text).split(/[,;\n]+/)) {
    const value = token.trim().replace(/^#/, '').replace(/\s+/g, ' ');
    if (value !== '' && !out.some((known) => fold(known) === fold(value))) {
      out.push(value);
    }
  }
  return out;
}

/**
 * Split a typed list of site codes ("CD1, my1"): upper-cased, duplicates
 * dropped, order kept.
 * @param {unknown} text
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseSiteCodes(text) {
  const valid = [];
  const invalid = [];
  for (const token of String(text).split(/[\s,;]+/)) {
    if (token === '') {
      continue;
    }
    const code = token.toUpperCase();
    if (/^[A-Z0-9]{2,8}$/.test(code)) {
      if (!valid.includes(code)) {
        valid.push(code);
      }
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

/** Lower case, without diacritics nor punctuation ("Kensington & Chelsea"). */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The refresh period, in milliseconds. */
export function periodMs(config) {
  return config.refreshMinutes * 60_000;
}
