// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface: English, French, German ("du") and Spanish ("usted").
//
// The four bands of the UK Daily Air Quality Index (DAQI) are translated from
// their official English names: Low (1-3), Moderate (4-6), High (7-9), Very
// High (10).
// -----------------------------------------------------------------------------

/** The DAQI bands, by stable key (scene filters and outputs), lowest first. */
export const BAND_KEYS = ['low', 'moderate', 'high', 'very_high'];

export const BANDS = {
  low: { en: 'Low', fr: 'Faible', de: 'Niedrig', es: 'Bajo' },
  moderate: { en: 'Moderate', fr: 'Modéré', de: 'Mäßig', es: 'Moderado' },
  high: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  very_high: { en: 'Very high', fr: 'Très élevé', de: 'Sehr hoch', es: 'Muy alto' },
};

/** The band of a DAQI value (1 to 10), as its rank 0 to 3. */
export function bandRank(level) {
  if (level >= 10) {
    return 3;
  }
  if (level >= 7) {
    return 2;
  }
  return level >= 4 ? 1 : 0;
}

/** Chemical formulas: the same in every language. */
export const FORMULAS = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  o3: 'O₃',
  so2: 'SO₂',
};

/** Feature names, by language (fixed when the device is added). */
export const NAMES = {
  en: {
    index: 'Air quality index (DAQI)',
    band: 'Air pollution',
    pm25: 'PM2.5 index',
    pm10: 'PM10 index',
    no2: 'Nitrogen dioxide index (NO₂)',
    o3: 'Ozone index (O₃)',
    so2: 'Sulphur dioxide index (SO₂)',
    age: 'Bulletin age',
  },
  fr: {
    index: "Indice de qualité de l'air (DAQI)",
    band: "Pollution de l'air",
    pm25: 'Indice PM2.5',
    pm10: 'Indice PM10',
    no2: "Indice dioxyde d'azote (NO₂)",
    o3: 'Indice ozone (O₃)',
    so2: 'Indice dioxyde de soufre (SO₂)',
    age: 'Âge du bulletin',
  },
  de: {
    index: 'Luftqualitätsindex (DAQI)',
    band: 'Luftverschmutzung',
    pm25: 'PM2.5-Index',
    pm10: 'PM10-Index',
    no2: 'Stickstoffdioxid-Index (NO₂)',
    o3: 'Ozon-Index (O₃)',
    so2: 'Schwefeldioxid-Index (SO₂)',
    age: 'Alter des Bulletins',
  },
  es: {
    index: 'Índice de calidad del aire (DAQI)',
    band: 'Contaminación del aire',
    pm25: 'Índice PM2.5',
    pm10: 'Índice PM10',
    no2: 'Índice de dióxido de nitrógeno (NO₂)',
    o3: 'Índice de ozono (O₃)',
    so2: 'Índice de dióxido de azufre (SO₂)',
    age: 'Antigüedad del boletín',
  },
};

/** Fixed texts. */
export const TEXT = {
  notConfigured: {
    en: 'No borough or site yet: use "Find an area", then type it in.',
    fr: 'Aucun arrondissement ni site : utilisez « Trouver une zone », puis saisissez-le.',
    de: 'Noch kein Bezirk und kein Standort: nutze „Gebiet finden“ und trage ihn dann ein.',
    es: 'Ningún distrito ni sitio: use «Buscar una zona» y escríbalo.',
  },
  apiUnreachable: {
    en: 'The London Air API does not answer: the values are not updated.',
    fr: "L'API de London Air ne répond pas : les valeurs ne sont plus mises à jour.",
    de: 'Die London-Air-API antwortet nicht: Die Werte werden nicht aktualisiert.',
    es: 'La API de London Air no responde: los valores no se actualizan.',
  },
  initFailed: {
    en: 'The integration could not start: see the Logs tab.',
    fr: "L'intégration n'a pas pu démarrer : voir l'onglet Journaux.",
    de: 'Die Integration konnte nicht starten: siehe Reiter Protokolle.',
    es: 'La integración no pudo iniciarse: consulte la pestaña Registros.',
  },
  noReading: {
    en: 'No air quality reading yet.',
    fr: "Pas encore de relevé de la qualité de l'air.",
    de: 'Noch keine Messung der Luftqualität.',
    es: 'Todavía no hay lectura de la calidad del aire.',
  },
  noArea: {
    en: 'No borough or site added to Gladys yet.',
    fr: 'Aucun arrondissement ni site ajouté à Gladys.',
    de: 'Noch kein Bezirk und kein Standort zu Gladys hinzugefügt.',
    es: 'Ningún distrito ni sitio añadido a Gladys.',
  },
  unknownArea: {
    en: 'This area is no longer read: check the configuration.',
    fr: "Cette zone n'est plus lue : vérifiez la configuration.",
    de: 'Dieses Gebiet wird nicht mehr gelesen: prüfe die Konfiguration.',
    es: 'Esta zona ya no se lee: compruebe la configuración.',
  },
  nothingConfigured: {
    en: 'No borough or site is configured.',
    fr: "Aucun arrondissement ni site n'est configuré.",
    de: 'Kein Bezirk und kein Standort ist konfiguriert.',
    es: 'No hay ningún distrito ni sitio configurado.',
  },
  noHouse: {
    en: 'Type a name, or set the location of a house in Settings → Houses.',
    fr: 'Saisissez un nom, ou placez une maison dans Paramètres → Maisons.',
    de: 'Gib einen Namen ein oder lege den Standort eines Hauses unter Einstellungen → Zuhause fest.',
    es: 'Escriba un nombre, o defina la ubicación de una casa en Configuración → Viviendas.',
  },
  catalogUnavailable: {
    en: 'The London Air list cannot be read now: try again in a minute.',
    fr: 'La liste de London Air est illisible pour le moment : réessayez dans une minute.',
    de: 'Die London-Air-Liste ist gerade nicht lesbar: versuche es in einer Minute erneut.',
    es: 'La lista de London Air no se puede leer ahora: inténtelo de nuevo en un minuto.',
  },
  airQuality: {
    en: 'Air pollution',
    fr: "Pollution de l'air",
    de: 'Luftverschmutzung',
    es: 'Contaminación del aire',
  },
  measured: { en: 'Bulletin', fr: 'Bulletin', de: 'Bulletin', es: 'Boletín' },
  noData: { en: 'No data', fr: 'Pas de donnée', de: 'Keine Daten', es: 'Sin datos' },
  source: {
    en: 'UK DAQI, 1 to 10 · London Air (Imperial College)',
    fr: 'DAQI britannique, 1 à 10 · London Air (Imperial College)',
    de: 'Britischer DAQI, 1 bis 10 · London Air (Imperial College)',
    es: 'DAQI británico, de 1 a 10 · London Air (Imperial College)',
  },
};

/** "Moderate (5)". */
export function bandLabel(level, language) {
  return `${BANDS[BAND_KEYS[bandRank(level)]][language]} (${level})`;
}

/** Texts built from values. */
export const MESSAGES = {
  /** "3 h ago", or "Outdated (2 d)" when stale. */
  measuredAgo(minutes, stale) {
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(minutes / 1440);
    const span =
      minutes < 60
        ? {
            en: `${minutes} min`,
            fr: `${minutes} min`,
            de: `${minutes} Min.`,
            es: `${minutes} min`,
          }
        : minutes < 2880
          ? { en: `${hours} h`, fr: `${hours} h`, de: `${hours} Std.`, es: `${hours} h` }
          : { en: `${days} d`, fr: `${days} j`, de: `${days} Tg.`, es: `${days} d` };
    if (stale) {
      return {
        en: `Outdated (${span.en})`,
        fr: `Périmé (${span.fr})`,
        de: `Veraltet (${span.de})`,
        es: `Desactualizado (${span.es})`,
      };
    }
    return {
      en: `${span.en} ago`,
      fr: `il y a ${span.fr}`,
      de: `vor ${span.de}`,
      es: `hace ${span.es}`,
    };
  },

  /**
   * "London Air Camden: Moderate (4) · PM2.5 4 · NO₂ 2".
   * @param {{ area: string, level: number|null, values: Record<string, number> }} options
   */
  summary({ area, level, values }) {
    const parts = ['pm25', 'pm10', 'no2', 'o3', 'so2']
      .filter((key) => typeof values[key] === 'number')
      .map((key) => `${FORMULAS[key]} ${values[key]}`);
    return Object.fromEntries(
      ['en', 'fr', 'de', 'es'].map((lang) => {
        const label = level ? bandLabel(level, lang) : TEXT.noData[lang];
        const colon = lang === 'fr' ? ' :' : ':';
        return [lang, [`${area}${colon} ${label}`, ...parts].join(' · ')];
      }),
    );
  },

  /** An error thrown to Gladys: one text, the four languages joined. */
  thrown(text) {
    return ['en', 'fr', 'de', 'es'].map((lang) => text[lang]).join(' / ');
  },

  /**
   * One line of the "Check the areas" report.
   * @param {{ head: string, level?: number|null, minutes?: number|null, pollutants?: string[], error?: string|null, missing?: boolean, noSite?: boolean }} options
   */
  checkArea({ head, level, minutes, pollutants = [], error, missing, noSite }) {
    if (noSite) {
      return {
        en: `${head}: no monitoring site in this borough now, choose a site nearby`,
        fr: `${head} : aucun site de mesure dans cet arrondissement, choisissez un site proche`,
        de: `${head}: derzeit kein Messstandort in diesem Bezirk, wähle einen Standort in der Nähe`,
        es: `${head}: ningún sitio de medición en este distrito, elija un sitio cercano`,
      };
    }
    if (missing) {
      return {
        en: `${head}: not in the London Air bulletin (see "Find an area")`,
        fr: `${head} : absent du bulletin de London Air (voir « Trouver une zone »)`,
        de: `${head}: nicht im London-Air-Bulletin (siehe „Gebiet finden“)`,
        es: `${head}: no figura en el boletín de London Air (vea «Buscar una zona»)`,
      };
    }
    if (error) {
      return {
        en: `${head}: error (${error})`,
        fr: `${head} : erreur (${error})`,
        de: `${head}: Fehler (${error})`,
        es: `${head}: error (${error})`,
      };
    }
    const list = pollutants.map((key) => FORMULAS[key]).join(', ') || '-';
    const ago = minutes === null || minutes === undefined ? null : MESSAGES.measuredAgo(minutes);
    const out = {};
    for (const lang of ['en', 'fr', 'de', 'es']) {
      const label = level ? bandLabel(level, lang) : TEXT.noData[lang];
      const colon = lang === 'fr' ? ' :' : ':';
      out[lang] = `${head}${colon} ${label}, ${list}${ago ? ` (${ago[lang]})` : ''}`;
    }
    return out;
  },

  unknownBoroughs(names) {
    const list = names.join(', ');
    return {
      en: `Not London Air boroughs: ${list}`,
      fr: `Pas des arrondissements de London Air : ${list}`,
      de: `Keine London-Air-Bezirke: ${list}`,
      es: `No son distritos de London Air: ${list}`,
    };
  },

  invalidSites(codes) {
    const list = codes.join(', ');
    return {
      en: `Ignored, not site codes: ${list}`,
      fr: `Ignorés, ce ne sont pas des codes de site : ${list}`,
      de: `Ignoriert, keine Standortcodes: ${list}`,
      es: `Ignorados, no son códigos de sitio: ${list}`,
    };
  },

  tooMany(max) {
    return {
      en: `Only the first ${max} boroughs and sites are read.`,
      fr: `Seuls les ${max} premiers arrondissements et sites sont lus.`,
      de: `Nur die ersten ${max} Bezirke und Standorte werden gelesen.`,
      es: `Solo se leen los ${max} primeros distritos y sitios.`,
    };
  },

  /**
   * The result of "Find an area".
   * @param {{ query: string, house?: string, boroughs: object[], sites: object[], more: number }} options
   */
  found({ query, house, boroughs, sites, more }) {
    const where = query
      ? {
          en: `for "${query}"`,
          fr: `pour « ${query} »`,
          de: `für „${query}“`,
          es: `para «${query}»`,
        }
      : {
          en: `near ${house}`,
          fr: `autour de ${house}`,
          de: `in der Nähe von ${house}`,
          es: `cerca de ${house}`,
        };
    if (boroughs.length === 0 && sites.length === 0) {
      return {
        en: `No London Air borough or site ${where.en}.`,
        fr: `Aucun arrondissement ni site de London Air ${where.fr}.`,
        de: `Kein London-Air-Bezirk und kein Standort ${where.de}.`,
        es: `Ningún distrito ni sitio de London Air ${where.es}.`,
      };
    }
    const km = (place) =>
      place.distanceKm === undefined ? '' : ` (${formatNumber(place.distanceKm)} km)`;
    const out = {};
    for (const lang of ['en', 'fr', 'de', 'es']) {
      const lines = [];
      if (boroughs.length > 0) {
        lines.push(
          {
            en: `Boroughs ${where.en}, to type in "Boroughs":`,
            fr: `Arrondissements ${where.fr}, à saisir dans « Arrondissements » :`,
            de: `Bezirke ${where.de}, in „Bezirke“ einzutragen:`,
            es: `Distritos ${where.es}, para escribir en «Distritos»:`,
          }[lang],
        );
        for (const borough of boroughs) {
          const count = {
            en: `${borough.siteCount} site(s)`,
            fr: `${borough.siteCount} site(s)`,
            de: `${borough.siteCount} Standort(e)`,
            es: `${borough.siteCount} sitio(s)`,
          }[lang];
          lines.push(`${borough.name}${km(borough)}, ${count}`);
        }
      }
      if (sites.length > 0) {
        lines.push(
          {
            en: `Sites ${where.en}, to type in "Sites":`,
            fr: `Sites ${where.fr}, à saisir dans « Sites » :`,
            de: `Standorte ${where.de}, in „Standorte“ einzutragen:`,
            es: `Sitios ${where.es}, para escribir en «Sitios»:`,
          }[lang],
        );
        for (const site of sites) {
          lines.push(`${site.code} ${site.name}${km(site)}`);
        }
      }
      if (more) {
        lines.push(
          {
            en: `…and ${more} more: refine the search.`,
            fr: `…et ${more} autres : affinez la recherche.`,
            de: `…und ${more} weitere: verfeinere die Suche.`,
            es: `…y ${more} más: afine la búsqueda.`,
          }[lang],
        );
      }
      out[lang] = lines.join('\n');
    }
    return out;
  },
};

/** A number with one decimal at most. */
export function formatNumber(value) {
  return String(Math.round(value * 10) / 10);
}
