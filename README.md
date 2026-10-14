# Scryway Ephemeris

The astrological calculation service behind [Scryway](https://scryway.com)'s natal charts. It takes moments in
time and a place on Earth and returns planetary positions, house cusps and angles, calculated with the
[Swiss Ephemeris](https://www.astro.com/swisseph/).

This service is free software under the **GNU Affero General Public License v3.0 or later** (see `LICENSE`).
If you use Scryway's charts, this is the source code of the program that calculated them, and you have the
rights the AGPL gives you to study, change and share it.

It is a separate program from the rest of Scryway: Scryway sends it a request over HTTPS and displays the
answer. It contains no Scryway application code and stores nothing.

## Credits and licences

- **Swiss Ephemeris** is Copyright (C) 1997-2021 Astrodienst AG, Switzerland. Used here under the GNU AGPL,
  one of the two licences Astrodienst offers (the other is the commercial Swiss Ephemeris Professional
  License).
- **Ephemeris files** in `ephe/` (`sepl_18.se1`, `semo_18.se1`, `seas_18.se1`) are distributed by Astrodienst
  with the Swiss Ephemeris, from https://github.com/aloistr/swisseph/tree/master/ephe. They cover 1800-2399
  and are derived from NASA JPL's DE441. Outside that range the Swiss Ephemeris falls back to the Moshier
  analytical theory and responses say so.
- **Node.js bindings**: [sweph](https://github.com/timotejroiko/sweph) by Timotej Valentin Rojko, AGPL-3.0 or
  LGPL-3.0.

## API

`POST /compute` with a JSON body:

```json
{
  "instants": ["1985-03-01T22:00:00Z"],
  "latitude": 51.5074,
  "longitude": -0.1278,
  "house_system": "placidus",
  "zodiac": "tropical",
  "bodies": ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "mean_node", "true_node"],
  "houses": true
}
```

- `instants`: 1 to 8 UTC timestamps (ISO 8601). Several are allowed so a client can bracket an uncertain
  birth time in one request.
- `latitude` (north positive) and `longitude` (east positive), in degrees.
- `house_system`: `placidus`, `koch`, `porphyry`, `regiomontanus`, `campanus`, `equal`, `whole_sign`,
  `alcabitius`, `topocentric` or `morinus`. Default `placidus`.
- `zodiac`: `tropical` (default), or a sidereal zodiac: `lahiri`, `fagan_bradley`, `raman`, `krishnamurti`.
- `bodies`: optional subset; default all. `houses: false` skips house calculation.

Response:

```json
{
  "engine": { "name": "Swiss Ephemeris", "version": "2.10.03", "bindings": "sweph 2.10.3-8", "service": "scryway-ephemeris 1.0.0", "ephemeris_files": "..." },
  "settings": { "zodiac": "tropical", "house_system": "placidus", "frame": "apparent geocentric, true ecliptic and equinox of date" },
  "results": [
    {
      "instant": "1985-03-01T22:00:00.000Z",
      "jd_ut": 2446126.4166...,
      "placements": [{ "key": "sun", "lon": 341.27, "lat": 0.0, "speed": 1.0 }],
      "houses": { "cusps": [12 longitudes], "asc": 207.8, "mc": 127.1, "armc": 129.8, "vertex": 0.0 },
      "ayanamsa": null,
      "warnings": []
    }
  ],
  "source": "https://github.com/AaronHawk/scryway-ephemeris"
}
```

Longitudes are degrees from 0° Aries (in the chosen zodiac); `speed` is degrees per day (negative means
retrograde). If a house system cannot be calculated at a latitude (Placidus and Koch inside the polar
circles), `houses` is `{ "error": "..." }`.

`GET /` describes the service; `GET /source` redirects here. Every response carries `X-Source-Code` and
`X-License` headers.

Requests are accepted from Scryway's own sites (CORS); set `ALLOWED_ORIGINS` (comma-separated) to change that.

## Running it

```
npm install
npm test          # positions checked against NASA JPL Horizons (test/horizons.json)
npm start         # http://localhost:8787
```

It is deployed on Vercel as serverless functions (`api/`); `vercel.json` bundles the ephemeris files.

## Privacy

The service calculates and answers. It does not store, log or forward request bodies.
