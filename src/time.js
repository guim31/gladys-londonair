// -----------------------------------------------------------------------------
// London Air dates: "2026-10-24 08:00:00", in UK local time (GMT / BST), with
// no offset. The container runs in the time zone of Gladys (TZ), which may be
// another one: the offset is computed here, with the UK summer time rule (last
// Sunday of March to last Sunday of October, 01:00 UTC), so no time zone
// database is needed in the image.
// -----------------------------------------------------------------------------

const HOUR_MS = 3_600_000;

/** 01:00 UTC on the last Sunday of a month (0-based), in ms. */
function lastSundayAt1Utc(year, month) {
  const last = new Date(Date.UTC(year, month + 1, 0, 1));
  return last.getTime() - last.getUTCDay() * 24 * HOUR_MS;
}

/** True when the UK is on summer time (BST, UTC+1) at this instant. */
export function isSummerTime(ms) {
  const year = new Date(ms).getUTCFullYear();
  return ms >= lastSundayAt1Utc(year, 2) && ms < lastSundayAt1Utc(year, 9);
}

/**
 * A London Air date as epoch milliseconds, or null when it is not one.
 * In the hour repeated in October, the summer time reading is kept.
 * @param {unknown} text
 * @returns {number|null}
 */
export function parseLondonTime(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    String(text ?? '').trim(),
  );
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(wall)) {
    return null;
  }
  const summer = wall - HOUR_MS;
  return isSummerTime(summer) ? summer : wall;
}
