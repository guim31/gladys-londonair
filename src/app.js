// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client: the real one (index.js) or the
// SDK's fake Gladys (tests). Every handler is registered here, before
// connect().
//
//   connected       -> config, areas known from /data, then a first read
//   poller          -> reads the bulletin on its own timer (src/poller.js)
//   onPoll          -> fallback of the timer
//   onDeviceCreated -> the states of the new device, now
//   actions         -> find an area, check the areas (src/actions.js)
//   scene action    -> get_air_quality (src/scenes.js)
//   scene triggers  -> fired by the hub on each new index (src/hub.js)
//   widget          -> air_quality (src/widgets.js)
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MAX_AREAS, normalizeConfig } from './config.js';
import { Hub } from './hub.js';
import { Store } from './store.js';
import { createPoller } from './poller.js';
import { ACTION, checkAreas, findArea } from './actions.js';
import { GET_AIR_QUALITY, getAirQuality } from './scenes.js';
import { WIDGET_KEY, buildAirQualityContent } from './widgets.js';
import { TEXT } from './i18n.js';

const logger = createLogger({ name: 'londonair' });

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {{ load: Function, save: Function, flush?: Function }} [options.store]
 * @param {typeof fetch} [options.fetch]
 * @param {boolean} [options.timers] run the polling timer
 * @param {() => number} [options.now]
 */
export function registerHandlers(gladys, { store = new Store(), fetch, timers = true, now } = {}) {
  let config = normalizeConfig();
  const getConfig = () => config;
  const hub = new Hub({ gladys, getConfig, store, fetch, now });
  const ready = hub.load();
  let lastStatus = null;
  let lastResolution = null;

  const poller = createPoller({ gladys, hub, getConfig, afterCycle, timers, now });

  /** Publish what the last reads changed: devices, states, /data, status, widget. */
  async function afterCycle() {
    // /data first: the level a scene event announces is saved before the
    // event leaves, so a crash in between does not fire it twice.
    await hub.save();
    if (hub.devicesChanged) {
      try {
        await publishDevices();
        hub.devicesChanged = false; // else sent again after the next read
      } catch (err) {
        hub.issues.fail('discovery', `Cannot publish the devices: ${err.message}`);
      }
    }
    for (const record of hub.configuredRecords()) {
      try {
        await hub.publishStates(record);
        hub.issues.ok(`publish:${record.id}`, `${record.name ?? record.id}: published again`);
      } catch (err) {
        // The others still go out; the next cycle sends what is missing.
        hub.issues.fail(
          `publish:${record.id}`,
          `Cannot publish ${record.name ?? record.id}: ${err.message}`,
        );
      }
    }
    await hub.save();
    await updateStatus();
    logResolution();
    if (hub.widgetChanged) {
      hub.widgetChanged = false;
      gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(hub.buildDevices(config));
  }

  /** The status of the Configuration screen, sent when it changes. */
  async function updateStatus() {
    let status = { connected: true };
    if (hub.issues.isFailing('api')) {
      status = { connected: false, message: TEXT.apiUnreachable };
    } else if (hub.units(config).length === 0) {
      status = { connected: false, message: TEXT.notConfigured };
    }
    const key = JSON.stringify(status);
    if (key !== lastStatus) {
      lastStatus = key;
      await gladys.setConnectionStatus(status.connected, status.message);
    }
  }

  /** One info line describing the config. */
  function logConfig() {
    logger.info(
      `Reading ${config.boroughs.length} borough(s) and ${config.siteCodes.length} site(s) every ${config.refreshMinutes} min`,
    );
    if (config.invalidSites.length > 0) {
      logger.warn(`Ignored, not site codes: ${config.invalidSites.join(', ')}`);
    }
  }

  /** Warnings that need the bulletin: unknown boroughs, too many areas. */
  function logResolution() {
    const unknown = hub.unknownBoroughs();
    const dropped = hub.allUnits().slice(MAX_AREAS);
    const key = JSON.stringify([unknown, dropped]);
    if (key === lastResolution) {
      return;
    }
    lastResolution = key;
    if (unknown.length > 0) {
      logger.warn(`Not London Air boroughs: ${unknown.join(', ')}`);
    }
    if (dropped.length > 0) {
      logger.warn(`Too many areas: ${dropped.join(', ')} not read`);
    }
  }

  async function start() {
    await ready;
    hub.prune(config);
    // The areas known from /data first: the Discovery tab is complete even
    // before the first read, or while the API is down.
    await publishDevices();
    await updateStatus();
    await poller.restart();
  }

  // --- Connection lifecycle ----------------------------------------------------
  // The SDK logs the WebSocket lifecycle itself.
  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      logConfig();
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    // Nothing reaches Gladys while it is away: the status is sent again on return.
    lastStatus = null;
  });

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    config = normalizeConfig(raw);
    logConfig();
    await start();
  });

  // --- Discovery -----------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await ready;
    // An area never found yet is read now, so the list shows its pollutants.
    const unread = hub.units(config).filter((key) => !hub.isKnown(hub.records.get(key)));
    if (unread.length > 0 || (config.boroughs.length > 0 && hub.catalog.boroughs.length === 0)) {
      await poller.refreshNow({ maxAgeMs: 60_000 });
    }
    await publishDevices();
  });

  // --- Polling: the timer's fallback --------------------------------------------
  gladys.onPoll((device) => poller.pollFromCore(device));

  // --- A device added (or updated) in Gladys: its states now ---------------------
  // The core dropped the states sent before the device existed, and the SDK
  // forgot them: send everything again (a read when the last one is older
  // than 10 minutes), and nudge the widget, which can now show it.
  async function onDeviceAdded(device) {
    await ready;
    const record = hub.recordByDevice(device.external_id);
    if (!record) {
      return;
    }
    // A read publishes every state (the SDK forgot them at the creation);
    // without one, they are sent again here.
    const read = await poller.refreshNow({ maxAgeMs: 10 * 60_000 });
    if (!read) {
      await hub.publishStates(record, { force: true });
    }
    gladys.requestWidgetRefresh(WIDGET_KEY);
  }
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(async () => {
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });

  // --- Configuration screen buttons ---------------------------------------------
  gladys.onAction(ACTION.FIND_AREA, async (fields) => {
    logger.info('Action: find an area');
    await ready;
    return findArea(gladys, hub, poller, fields ?? {});
  });

  gladys.onAction(ACTION.CHECK_AREAS, async () => {
    logger.info('Action: check the areas');
    await ready;
    return checkAreas(hub, poller, config);
  });

  // --- Scene action ---------------------------------------------------------------
  gladys.onSceneAction(GET_AIR_QUALITY, async (fields) => {
    await ready;
    return getAirQuality(hub, fields ?? {}, config.language);
  });

  // --- Dashboard widget -----------------------------------------------------------
  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    await ready;
    return buildAirQualityContent({ hub, gladys, settings, language });
  });

  return {
    hub,
    poller,
    ready,
    getConfig,
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      poller.stop();
      await store.flush?.();
    },
  };
}
