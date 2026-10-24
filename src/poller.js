// -----------------------------------------------------------------------------
// The container's own polling timer.
//
// London Air publishes an hourly bulletin: it is read every 30 or 60 minutes
// (`refresh_minutes`), far beyond the 60 s the core can schedule, so the
// devices are published with `should_poll: false` and the container reads
// the bulletin by itself. One timer ticks every minute; the bulletin is read
// when it is due, and not again within 90 % of the period, whoever asks
// (timer, core onPoll, a device just added). One request covers every area.
//
// The bulletin is read only when it is useful: an area added to Gladys, or an
// area never found yet (its first read tells what the device measures, for
// the Discovery tab).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { periodMs } from './config.js';

const logger = createLogger({ name: 'poller' });

/** The timer's tick. */
export const TICK_MS = 60_000;

/** A bulletin read less than this share of the period ago is not read again. */
const MIN_GAP = 0.9;

/**
 * @param {object} options
 * @param {object} options.gladys
 * @param {import('./hub.js').Hub} options.hub
 * @param {() => object} options.getConfig
 * @param {() => Promise<void>} options.afterCycle publishes what the read changed
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {() => number} [options.now]
 */
export function createPoller({
  gladys,
  hub,
  getConfig,
  afterCycle = async () => {},
  timers = true,
  now = () => Date.now(),
}) {
  /** When the bulletin was last read (start of the read). */
  let lastReadAt;
  let timer = null;
  let stopped = true;
  /** The cycles run one after the other: the last one queued. */
  let queue = Promise.resolve();

  /** True when an area needs the bulletin: added to Gladys, or never found. */
  function wanted(config) {
    if (config.boroughs.length > 0 && hub.catalog.boroughs.length === 0) {
      return true; // the names typed need the list
    }
    return hub.units(config).some((key) => {
      const record = hub.records.get(key);
      return !hub.isKnown(record) || hub.isCreated(record);
    });
  }

  /**
   * One cycle: the bulletin when due (force: whatever its age, maxAgeMs:
   * unless read more recently), then the publication.
   * Cycles never overlap (timer, restart, device added, actions).
   * @returns {Promise<boolean>} true when the bulletin was read
   */
  function cycle(options = {}) {
    const run = queue.then(() => runCycle(options));
    queue = run.catch(() => {});
    return run;
  }

  async function runCycle({ force = false, maxAgeMs, publish = false } = {}) {
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: cycle skipped');
      return false;
    }
    const config = getConfig();
    const gap = force ? (maxAgeMs ?? 0) : periodMs(config) * MIN_GAP;
    const due = lastReadAt === undefined || now() - lastReadAt >= gap;
    let read = false;
    if (due && (force || wanted(config))) {
      lastReadAt = now();
      read = true;
      try {
        await hub.refresh();
      } catch (err) {
        // Logged once by the hub's issue log; the next read retries.
        logger.debug(`Bulletin: ${err.message}`);
      }
    }
    // A restart publishes even without a read (devices and states from /data).
    if (read || publish) {
      await afterCycle();
    }
    return read;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Polling cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  return {
    /** (Re)start: read the bulletin now, then on the timer. */
    async restart() {
      stopped = false;
      try {
        await cycle({ force: true, publish: true });
      } finally {
        schedule();
      }
    },

    /** One timer cycle (tests). */
    cycle,

    /**
     * The core's onPoll, a fallback only (the devices do not ask for it):
     * read the bulletin unless it was read recently.
     * @param {{ external_id: string }} device
     */
    async pollFromCore(device) {
      if (!hub.recordByDevice(device.external_id)) {
        logger.debug(`onPoll ignored (not a configured area): ${device.external_id}`);
        return;
      }
      await cycle();
    },

    /**
     * Read the bulletin now (a device just added, an action), unless it was
     * read less than `maxAgeMs` ago.
     * @returns {Promise<boolean>} true when it was read (and published)
     */
    refreshNow({ maxAgeMs = 0 } = {}) {
      return cycle({ force: true, maxAgeMs });
    },

    /** When the bulletin was last read, undefined if never. */
    lastReadAt: () => lastReadAt,

    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
