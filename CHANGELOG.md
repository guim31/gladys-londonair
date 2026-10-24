# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-24

### Added

- London boroughs and monitoring sites of the London Air Quality Network,
  read from its open hourly bulletin (no account, one request for all): one
  device per borough or site with the UK Daily Air Quality Index (1 to 10), its
  band as a word, the index of each pollutant measured (PM2.5, PM10, NO₂, O₃,
  SO₂) and the age of the bulletin.
- "Find an area" button: the boroughs and sites by name or code, or the
  nearest to a Gladys house, with their distance.
- "Check the areas" button: what each configured borough and site gives now.
- "London air quality" dashboard widget, scene triggers "air pollution
  rising" (band filter) and "back to low", scene action "get the air quality".
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-londonair/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-londonair/releases/tag/v1.0.0
