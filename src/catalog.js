// -----------------------------------------------------------------------------
// The last London Air bulletin, parsed: every borough and its sites. It names
// the devices, resolves the boroughs typed by name, and feeds the "Find an
// area" button. Kept under /data (src/hub.js), so a restart while the API is
// down still knows the names.
// -----------------------------------------------------------------------------

import { fold } from './config.js';

export class Catalog {
  constructor() {
    /** @type {Array<{ code: string, name: string, lat: number|null, lon: number|null, sites: object[] }>} */
    this.boroughs = [];
    this.fetchedAt = 0;
  }

  /** Restore the list saved under /data. */
  restore(saved) {
    if (saved && Array.isArray(saved.boroughs) && typeof saved.fetchedAt === 'number') {
      this.boroughs = saved.boroughs.filter((borough) => borough && borough.code);
      this.fetchedAt = saved.fetchedAt;
    }
  }

  /** What is saved under /data: the names and places only (the values live in the records). */
  snapshot() {
    return {
      fetchedAt: this.fetchedAt,
      boroughs: this.boroughs.map(({ code, name, lat, lon, sites }) => ({
        code,
        name,
        lat,
        lon,
        sites: sites.map((site) => ({
          code: site.code,
          name: site.name,
          type: site.type,
          lat: site.lat,
          lon: site.lon,
        })),
      })),
    };
  }

  /** A new bulletin. */
  update(boroughs, at) {
    this.boroughs = boroughs;
    this.fetchedAt = at;
  }

  /** @param {string} code */
  borough(code) {
    return this.boroughs.find((borough) => borough.code === String(code));
  }

  /** A site and its borough. */
  site(code) {
    const wanted = String(code).toUpperCase();
    for (const borough of this.boroughs) {
      const site = borough.sites.find((candidate) => candidate.code === wanted);
      if (site) {
        return { site, borough };
      }
    }
    return null;
  }

  /**
   * The borough a typed name or number designates, or null: a number, the
   * exact name, else the only borough whose name starts the typed one or is
   * started by it ("Kingston upon Thames" is "Kingston" for London Air).
   * @param {string} typed
   */
  resolveBorough(typed) {
    const text = fold(typed);
    if (/^\d+$/.test(text)) {
      return this.borough(String(Number(text))) ?? null;
    }
    const exact = this.boroughs.find((borough) => fold(borough.name) === text);
    if (exact) {
      return exact;
    }
    const near = this.boroughs.filter((borough) => {
      const name = fold(borough.name);
      return text.startsWith(`${name} `) || name.startsWith(`${text} `);
    });
    return near.length === 1 ? near[0] : null;
  }
}

/** Distance between two points, in km (haversine). */
export function distanceKm(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const located = (place) => typeof place.lat === 'number' && typeof place.lon === 'number';

/**
 * The boroughs and sites matching a search: every word of the query in the
 * name (or the site code), sorted by distance to the house when one is
 * given, else by name.
 * @param {Catalog} catalog
 * @param {{ query?: string, origin?: { lat: number, lon: number } }} search
 */
export function searchAreas(catalog, { query = '', origin } = {}) {
  const words = fold(query).split(' ').filter(Boolean);
  const matches = (text) => words.every((word) => fold(text).includes(word));
  const withDistance = (place) =>
    origin && located(place) ? { ...place, distanceKm: distanceKm(origin, place) } : { ...place };
  const sort = (list) =>
    list.sort((a, b) =>
      origin
        ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        : a.name.localeCompare(b.name, 'en'),
    );
  const boroughs = catalog.boroughs
    .filter((borough) => matches(borough.name))
    .map((borough) => withDistance({ ...borough, siteCount: borough.sites.length }));
  const sites = catalog.boroughs
    .flatMap((borough) => borough.sites)
    .filter((site) => matches(`${site.name} ${site.code}`))
    .map(withDistance);
  return { boroughs: sort(boroughs), sites: sort(sites) };
}
