# London Air for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings the air quality of London, from the
[London Air Quality Network](https://www.londonair.org.uk) (LAQN) run by the
Environmental Research Group of Imperial College London, into Gladys: the UK
Daily Air Quality Index (DAQI) of each borough and each monitoring site, hour
by hour, with the index of each pollutant.

This integration is **not affiliated with London Air or Imperial College
London**.

Looking for a model-based air quality anywhere in the world? See
[`prohand/gladys-airquality`](https://github.com/prohand/gladys-airquality)
(Copernicus CAMS). Here: the measurements of the London network. Citizen
sensors: [`guim31/gladys-sensor-community`](https://github.com/guim31/gladys-sensor-community).

## What it does

- **Boroughs and monitoring sites** of the LAQN, through the open London Air
  API (`api.erg.ic.ac.uk`): no account, no key. A **Find an area** button
  searches the boroughs and sites by name or code, or lists the nearest ones
  to the location of a Gladys house, with their distance.
- **One device per borough** (pollutant by pollutant, the worst of its sites)
  **or per site**, 10 in all at most: the DAQI (1 low to 10 very high), its
  band as a word (Low, Moderate, High, Very high), the index of each pollutant
  measured (PM2.5, PM10, NO₂, O₃, SO₂) and the age of the bulletin. A bulletin
  older than 3 hours is not published as current.
- A **London air quality** dashboard widget (band colored, pollutant tiles),
  two scene triggers, **air pollution rising** (the band rises to "Moderate"
  or worse, the bands picked as filters) and **back to low**, and a scene
  action **Get the air quality** (one area or the worst one, with a sentence
  ready for a notification).

Read only. Tested against the real API: the test fixture is the hourly
bulletin recorded on 24 October 2026.

The user documentation, in [English](docs/en.md), [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md), is re-hosted by Gladys behind
the **Documentation** link of the Configuration screen.

## Requirements

- Gladys Assistant **5.2.0** or later (the area search uses the house picker
  of 5.2.0; the widget and the scene cards need 5.1).
- Internet access to `api.erg.ic.ac.uk`.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-londonair`. Then fill the Configuration tab:
see [the documentation](docs/en.md#configuration).

## Respect of the API

London Air publishes no rate limit. The integration:

- reads the hourly bulletin of all London in **one request**, every 30 minutes
  (or every hour), whatever the number of boroughs and sites;
- reads it only while one of the configured areas is added to Gladys (and,
  once, to list the new ones in the Discovery tab), and at start-up;
- sends a `User-Agent` naming the integration and this repository.

## Limits

- The hourly bulletin gives **indices, not concentrations** (µg/m³): each
  pollutant is published as its DAQI index, 1 to 10.
- Many pollutants are "No data" in the bulletin at a given hour (last hour not
  received yet, analyser out of service): nothing is published for them.
- Some boroughs have no site in the bulletin (Barnet, Bromley, the City of
  London… on 24 October 2026).
- Measurements, not forecasts.

## Development

```bash
npm install
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test, against the SDK's fake Gladys
```

The tests never touch the network: they run on the London Air bulletin
recorded on 24 October 2026 (`test/fixtures/londonair`). The architecture and
the rules of the project are in [`CLAUDE.md`](CLAUDE.md).

## Credits

- [London Air](https://www.londonair.org.uk) and the Environmental Research
  Group of Imperial College London, for the London Air Quality Network and its
  open API. The data are used as published.
- The Home Assistant [`london_air` integration](https://www.home-assistant.io/integrations/london_air/)
  (Apache-2.0): the API endpoint and the borough approach, read for reference,
  nothing copied.
- The logo on the cover is the London Air logo, from
  [londonair.org.uk](https://www.londonair.org.uk); it only names the data
  source.
- Built from the official
  [JavaScript template](https://github.com/GladysAssistant/integration-template-js)
  and SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

## License

[Apache-2.0](LICENSE)
