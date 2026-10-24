// -----------------------------------------------------------------------------
// The boroughs and sites the integration reads, what it knows about them, and
// what it publishes to Gladys.
//
// One request gives the hourly bulletin of all London (src/api.js). Reading it
// (refresh) updates the "record" of each configured area — name, pollutants,
// the index of each, the overall index, the bulletin hour — persisted under
// /data; the record gives the Gladys device (src/devices.js) and its states.
//
// A borough's index is the highest of its sites, pollutant by pollutant, as
// on londonair.org.uk; a site's index is its highest pollutant index.
//
// Freshness: a bulletin older than STALE_MINUTES is NOT published (nor sent
// again by the heartbeat): a value Gladys shows as recent is a recent one.
// Only the age keeps moving.
//
// Scene triggers, on each new bulletin, by DAQI band:
//   air_quality_degraded       the band rises to "Moderate" (4) or worse;
//   air_quality_back_to_normal it comes back to "Low" (1 to 3).
// The first index after the install sets the starting band, without event.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { fetchIndex } from './api.js';
import { Catalog } from './catalog.js';
import { MAX_AREAS } from './config.js';
import {
  AGE_KEY,
  BAND_KEY,
  INDEX_KEY,
  KIND,
  POLLUTANTS,
  areaKey,
  areaKeyOf,
  buildDevice,
  deviceName,
  idsOf,
  parseAreaKey,
  pollutantsOf,
} from './devices.js';
import { createIssueLog } from './issues.js';
import { BANDS, BAND_KEYS, FORMULAS, MESSAGES, bandLabel, bandRank } from './i18n.js';

const logger = createLogger({ name: 'areas' });

/** Past this age, a bulletin is stale: not published, and the widget says so. */
export const STALE_MINUTES = 180;

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/**
 * A band seen longer ago than this is no reference for a scene event: the
 * area was not read meanwhile (device added days after the configuration,
 * container stopped), and the next index starts afresh, without event.
 */
const ANNOUNCED_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** From this band rank on, the air quality is degraded ("Moderate", DAQI 4). */
export const DEGRADED_FROM = 1;

/** Keys of the scene triggers. */
export const TRIGGER = {
  DEGRADED: 'air_quality_degraded',
  BACK_TO_NORMAL: 'air_quality_back_to_normal',
};

const STORE_VERSION = 1;

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch };
    this.now = now;
    this.catalog = new Catalog();
    /** Record by area key ("borough:7", "site:CD1"). */
    this.records = new Map();
    /** Set when the device list must be published again (new pollutant, name). */
    this.devicesChanged = false;
    /** Set when the widget content changed. */
    this.widgetChanged = false;
    this.persistNeeded = false;
    /** Scene events waiting for the publication of their area's states. */
    this.pendingEvents = new Map();
    /** Outcome of the last read of each area: { ok, error?, missing? }. */
    this.lastResults = new Map();
    this.issues = createIssueLog(logger);
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    this.catalog.restore(data.catalog);
    for (const record of data.records ?? []) {
      if (record && /^(borough|site):[A-Za-z0-9]+$/.test(String(record.id))) {
        this.records.set(record.id, record);
      }
    }
  }

  async persist() {
    await this.store.save({
      version: STORE_VERSION,
      catalog: this.catalog.snapshot(),
      records: [...this.records.values()],
    });
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded) {
      this.persistNeeded = false;
      await this.persist();
    }
  }

  /**
   * The configured areas: the boroughs (resolved by the last bulletin, names
   * unknown yet left out), then the sites, MAX_AREAS at most.
   * @returns {string[]} area keys
   */
  allUnits(config = this.getConfig()) {
    const keys = [];
    for (const typed of config.boroughs) {
      const borough = this.catalog.resolveBorough(typed);
      if (borough) {
        keys.push(areaKey(KIND.BOROUGH, borough.code));
      } else if (/^\d+$/.test(typed) && this.catalog.boroughs.length === 0) {
        // A number needs no list: read it, the bulletin will tell.
        keys.push(areaKey(KIND.BOROUGH, String(Number(typed))));
      }
    }
    for (const code of config.siteCodes) {
      keys.push(areaKey(KIND.SITE, code));
    }
    return [...new Set(keys)];
  }

  /** The configured areas that are read (MAX_AREAS at most). */
  units(config = this.getConfig()) {
    return this.allUnits(config).slice(0, MAX_AREAS);
  }

  /** The boroughs typed that the last bulletin does not know. */
  unknownBoroughs(config = this.getConfig()) {
    if (this.catalog.boroughs.length === 0) {
      return [];
    }
    return config.boroughs.filter((typed) => !this.catalog.resolveBorough(typed));
  }

  /** The records of the configured areas, in the configured order. */
  configuredRecords(config = this.getConfig()) {
    return this.units(config)
      .map((key) => this.records.get(key))
      .filter(Boolean);
  }

  /** The record of a device (or feature) external id, if configured. */
  recordByDevice(externalId) {
    const key = areaKeyOf(externalId);
    return key && this.units().includes(key) ? this.records.get(key) : undefined;
  }

  /** True when the user added the area's device to Gladys. */
  isCreated(record) {
    const id = idsOf(this.gladys, record.id).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(record) {
    const id = idsOf(this.gladys, record.id).device;
    return (
      (this.gladys.devices ?? []).find((device) => device.external_id === id)?.name ||
      deviceName(record)
    );
  }

  /** True once the area was found in a bulletin (its pollutants are known). */
  isKnown(record) {
    return Boolean(record?.seen);
  }

  /** The discovery payloads of the configured areas found at least once. */
  buildDevices(config = this.getConfig()) {
    return this.configuredRecords(config)
      .filter((record) => this.isKnown(record))
      .map((record) => buildDevice(this.gladys, record, config.language));
  }

  /** Minutes since the hour of the bulletin, or null. */
  ageMinutes(record) {
    if (typeof record?.at !== 'number') {
      return null;
    }
    return Math.max(0, Math.floor((this.now() - record.at) / 60_000));
  }

  /** True when the bulletin is older than STALE_MINUTES (or absent). */
  isStale(record) {
    const minutes = this.ageMinutes(record);
    return minutes === null || minutes > STALE_MINUTES;
  }

  /** The current index of a record: `{ level, rank, key }`, or null (none, or stale). */
  indexOf(record) {
    if (!record || typeof record.level !== 'number' || this.isStale(record)) {
      return null;
    }
    const rank = bandRank(record.level);
    return { level: record.level, rank, key: BAND_KEYS[rank] };
  }

  /** The fresh pollutant indices of a record. */
  valuesOf(record) {
    const values = {};
    if (!record || this.isStale(record)) {
      return values;
    }
    for (const key of pollutantsOf(record)) {
      const value = record.species?.[key];
      if (typeof value === 'number') {
        values[key] = value;
      }
    }
    return values;
  }

  /** The pollutants setting the index, as formulas, '' without index. */
  criticalPollutants(record) {
    const index = this.indexOf(record);
    if (!index) {
      return '';
    }
    return POLLUTANTS.filter((key) => record.species?.[key] === index.level)
      .map((key) => FORMULAS[key])
      .join(', ');
  }

  /**
   * Read the bulletin and update every configured area.
   * @returns {Promise<void>} rejects when the bulletin cannot be read
   */
  async refresh() {
    let boroughs;
    try {
      boroughs = await fetchIndex(this.deps);
    } catch (err) {
      for (const key of this.units()) {
        this.lastResults.set(key, { ok: false, error: err.message });
      }
      this.issues.fail('api', err.message);
      throw err;
    }
    this.issues.ok('api', 'The London Air API answers again');
    this.catalog.update(boroughs, this.now());
    this.persistNeeded = true;
    for (const key of this.units()) {
      this.apply(key);
    }
    logger.debug(`Bulletin read: ${boroughs.length} boroughs`);
  }

  /** The bulletin of one area: what it measures and its indices. */
  apply(key) {
    const { kind, code } = parseAreaKey(key);
    let name;
    let sites;
    if (kind === KIND.BOROUGH) {
      const borough = this.catalog.borough(code);
      name = borough?.name;
      sites = borough?.sites ?? [];
    } else {
      const found = this.catalog.site(code);
      name = found?.site.name;
      sites = found ? [found.site] : [];
    }
    const record = this.records.get(key) ?? { id: key, pollutants: [], species: {} };
    this.records.set(key, record);
    if (sites.length === 0) {
      // A borough without site, a site closed or offline: kept, stale soon.
      record.name ??= name;
      this.lastResults.set(key, { ok: false, missing: true });
      this.issues.fail(`area:${key}`, `${deviceName(record)}: not in the bulletin`);
      return;
    }
    const before = JSON.stringify({ index: this.indexOf(record), values: this.valuesOf(record) });
    if (name && name !== record.name) {
      record.name = name;
      this.devicesChanged = true;
    }
    if (!record.seen) {
      logger.info(`${kind === KIND.SITE ? 'Site' : 'Borough'} ${code} found: ${record.name}`);
      record.seen = true;
      this.devicesChanged = true;
    }
    const species = {};
    for (const site of sites) {
      for (const [pollutant, value] of Object.entries(site.species)) {
        this.learn(record, pollutant);
        if (typeof value === 'number') {
          species[pollutant] = Math.max(species[pollutant] ?? 0, value);
        }
      }
    }
    const times = sites.map((site) => site.at).filter((at) => typeof at === 'number');
    const at = times.length > 0 ? Math.max(...times) : null;
    const values = Object.values(species);
    const level = values.length > 0 ? Math.max(...values) : null;
    const changed = record.at !== at || record.level !== level;
    Object.assign(record, { species, at, level });
    if (changed) {
      this.applyLevel(record);
    }
    if (JSON.stringify({ index: this.indexOf(record), values: this.valuesOf(record) }) !== before) {
      this.widgetChanged = true;
    }
    this.lastResults.set(key, { ok: true });
    this.issues.ok(`area:${key}`, `${deviceName(record)}: back in the bulletin`);
  }

  /** A pollutant the area measures: a feature, forever. */
  learn(record, pollutant) {
    if (!record.pollutants.includes(pollutant)) {
      record.pollutants.push(pollutant);
      this.devicesChanged = true;
    }
  }

  /** A new index: evaluate the scene triggers. */
  applyLevel(record) {
    const index = this.indexOf(record);
    if (!index) {
      return;
    }
    const event = this.bandEvent(record, index);
    if (event) {
      this.pendingEvents.set(record.id, event);
    }
  }

  /**
   * The scene event of a new index, if any. `announced` is the last band rank
   * seen, `worst` the worst index of the ongoing degradation.
   */
  bandEvent(record, index) {
    const recent =
      typeof record.announcedAt === 'number' &&
      this.now() - record.announcedAt <= ANNOUNCED_MAX_AGE_MS;
    const previous = recent ? record.announced : null;
    const previousLevel = recent ? record.announcedLevel : null;
    record.announced = index.rank;
    record.announcedLevel = index.level;
    record.announcedAt = this.now();
    if (previous === null || previous === undefined) {
      record.worst = index.rank >= DEGRADED_FROM ? index.level : null;
      return null;
    }
    const language = this.getConfig().language;
    const common = {
      area: idsOf(this.gladys, record.id).device,
      area_name: this.nameOf(record),
      band: index.key,
      band_label: BANDS[index.key][language],
      index: index.level,
    };
    if (index.rank >= DEGRADED_FROM && index.rank > previous) {
      record.worst = Math.max(record.worst ?? index.level, index.level);
      return {
        key: TRIGGER.DEGRADED,
        data: {
          ...common,
          previous_band: BAND_KEYS[previous],
          previous_index: previousLevel,
          pollutant: this.criticalPollutants(record),
          summary: this.summary(record, language),
        },
      };
    }
    if (index.rank < DEGRADED_FROM && previous >= DEGRADED_FROM) {
      const worst = Math.max(record.worst ?? previousLevel, previousLevel);
      const worstKey = BAND_KEYS[bandRank(worst)];
      record.worst = null;
      return {
        key: TRIGGER.BACK_TO_NORMAL,
        data: {
          ...common,
          worst_band: worstKey,
          worst_band_label: bandLabel(worst, language),
          worst_index: worst,
          summary: this.summary(record, language),
        },
      };
    }
    if (index.rank >= DEGRADED_FROM) {
      record.worst = Math.max(record.worst ?? index.level, index.level);
    }
    return null;
  }

  /** The ready-made sentence of an area, in a language. */
  summary(record, language) {
    return MESSAGES.summary({
      area: this.nameOf(record),
      level: this.indexOf(record)?.level ?? null,
      values: this.valuesOf(record),
    })[language];
  }

  /**
   * Publish the states of an area whose device exists in Gladys: its fresh
   * indices and band, and the bulletin age. Only the changes go out (the SDK
   * deduplicates), plus a heartbeat.
   * @param {object} record
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(record, { force = false } = {}) {
    if (!this.isCreated(record)) {
      // No device, no scene can name it: the event is dropped.
      this.pendingEvents.delete(record.id);
      return;
    }
    const ids = idsOf(this.gladys, record.id);
    if (force) {
      this.gladys.forgetPublishedStates(ids.device);
    }
    const language = this.getConfig().language;
    const states = [];
    const state = (key, value) =>
      states.push({
        device_feature_external_id: ids.feature(key),
        ...(typeof value === 'string' ? { text: value } : { state: value }),
      });
    const index = this.indexOf(record);
    if (index) {
      state(INDEX_KEY, index.level);
      state(BAND_KEY, BANDS[index.key][language]);
    }
    for (const [key, value] of Object.entries(this.valuesOf(record))) {
      state(key, value);
    }
    const minutes = this.ageMinutes(record);
    if (minutes !== null) {
      state(AGE_KEY, minutes);
    }
    let failure = null;
    if (states.length > 0) {
      try {
        await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
      } catch (err) {
        failure = err;
      }
    }
    // The event goes out even if the states failed, and stays pending until
    // Gladys took it: `announced` already moved, it would never come again.
    const event = this.pendingEvents.get(record.id);
    if (event) {
      await this.gladys.publishSceneEvent(event.key, event.data);
      this.pendingEvents.delete(record.id);
      logger.info(`${deviceName(record)}: air pollution ${event.data.band} (${event.data.index})`);
    }
    if (failure) {
      throw failure;
    }
  }

  /** Forget the records of the areas no longer configured. */
  prune(config = this.getConfig()) {
    if (config.boroughs.length > 0 && this.catalog.boroughs.length === 0) {
      return; // the boroughs typed by name are not resolved yet
    }
    const kept = new Set(this.units(config));
    for (const key of this.records.keys()) {
      if (!kept.has(key)) {
        this.records.delete(key);
        this.persistNeeded = true;
      }
    }
  }
}
