// Scryway Ephemeris: chart calculations with the Swiss Ephemeris.
//
// Copyright (C) 2026 Scryway. Licensed under the GNU Affero General Public License v3.0 or
// later (see LICENSE). Swiss Ephemeris is Copyright (C) 1997-2021 Astrodienst AG, Switzerland,
// used here under the AGPL; the Node bindings (sweph) are by Timotej Valentin Rojko.
//
// This module is a stand-alone calculation service: it receives instants and a place and
// returns positions, house cusps and angles. It contains no application logic and keeps no
// data: nothing it receives is stored or logged.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sweph = require("sweph");
const C = sweph.constants;

const here = path.dirname(fileURLToPath(import.meta.url));
export const EPHE_PATH = path.resolve(here, "..", "ephe");
sweph.set_ephe_path(EPHE_PATH);

export const SOURCE_URL = "https://github.com/AaronHawk/scryway-ephemeris";
export const SERVICE_VERSION = "1.0.0";

export const BODIES = {
  sun: C.SE_SUN,
  moon: C.SE_MOON,
  mercury: C.SE_MERCURY,
  venus: C.SE_VENUS,
  mars: C.SE_MARS,
  jupiter: C.SE_JUPITER,
  saturn: C.SE_SATURN,
  uranus: C.SE_URANUS,
  neptune: C.SE_NEPTUNE,
  pluto: C.SE_PLUTO,
  chiron: C.SE_CHIRON,
  mean_node: C.SE_MEAN_NODE,
  true_node: C.SE_TRUE_NODE,
};

export const HOUSE_SYSTEMS = {
  placidus: "P",
  koch: "K",
  porphyry: "O",
  regiomontanus: "R",
  campanus: "C",
  equal: "A",
  whole_sign: "W",
  alcabitius: "B",
  topocentric: "T",
  morinus: "M",
};

export const AYANAMSAS = {
  lahiri: C.SE_SIDM_LAHIRI,
  fagan_bradley: C.SE_SIDM_FAGAN_BRADLEY,
  raman: C.SE_SIDM_RAMAN,
  krishnamurti: C.SE_SIDM_KRISHNAMURTI,
};

export class InputError extends Error {}

export function engineInfo() {
  return {
    name: "Swiss Ephemeris",
    version: sweph.version(),
    bindings: "sweph 2.10.3-8",
    service: `scryway-ephemeris ${SERVICE_VERSION}`,
    ephemeris_files: "sepl_18, semo_18, seas_18 (1800-2399, from JPL DE441); Moshier analytical theory outside that range",
  };
}

const isNum = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function validate(body) {
  if (!body || typeof body !== "object") throw new InputError("Expected a JSON object.");
  const { instants, latitude, longitude } = body;
  if (!Array.isArray(instants) || instants.length < 1 || instants.length > 8) throw new InputError("instants: 1 to 8 ISO 8601 UTC timestamps.");
  const dates = instants.map((s) => {
    const d = typeof s === "string" ? new Date(s) : null;
    if (!d || Number.isNaN(d.getTime())) throw new InputError(`Not a timestamp: ${String(s).slice(0, 40)}`);
    if (d.getUTCFullYear() < 1 || d.getUTCFullYear() > 3000) throw new InputError("Years 1 to 3000 are supported.");
    return d;
  });
  if (!isNum(latitude, -90, 90)) throw new InputError("latitude: -90 to 90.");
  if (!isNum(longitude, -180, 180)) throw new InputError("longitude: -180 to 180 (east positive).");
  const house_system = body.house_system ?? "placidus";
  if (!(house_system in HOUSE_SYSTEMS)) throw new InputError(`house_system: one of ${Object.keys(HOUSE_SYSTEMS).join(", ")}.`);
  const zodiac = body.zodiac ?? "tropical";
  if (zodiac !== "tropical" && !(zodiac in AYANAMSAS)) throw new InputError(`zodiac: tropical or one of ${Object.keys(AYANAMSAS).join(", ")}.`);
  const bodies = body.bodies ?? Object.keys(BODIES);
  if (!Array.isArray(bodies) || bodies.some((b) => !(b in BODIES))) throw new InputError(`bodies: any of ${Object.keys(BODIES).join(", ")}.`);
  const houses = body.houses !== false;
  return { dates, latitude, longitude, house_system, zodiac, bodies, houses };
}

function julianDayUT(d) {
  const r = sweph.utc_to_jd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds() + d.getUTCMilliseconds() / 1000, C.SE_GREG_CAL);
  if (r.flag !== C.OK) throw new InputError(r.error || "Invalid date.");
  return r.data[1]; // UT1
}

/**
 * Positions (apparent geocentric ecliptic longitude, latitude, speed in degrees per day),
 * and, unless houses are switched off, house cusps and angles for each instant.
 */
export function compute(input) {
  const q = validate(input);
  let flags = C.SEFLG_SWIEPH | C.SEFLG_SPEED;
  if (q.zodiac !== "tropical") {
    sweph.set_sid_mode(AYANAMSAS[q.zodiac], 0, 0);
    flags |= C.SEFLG_SIDEREAL;
  }

  const results = q.dates.map((date) => {
    const jd = julianDayUT(date);
    const warnings = new Set();
    const placements = [];
    for (const key of q.bodies) {
      const r = sweph.calc_ut(jd, BODIES[key], flags);
      if (r.flag < 0) {
        warnings.add(`${key}: ${r.error.trim()}`);
        continue;
      }
      if (r.flag & C.SEFLG_MOSEPH) warnings.add("Outside the ephemeris files' range: the Moshier theory was used (accurate to about a second of arc for planets).");
      placements.push({ key, lon: r.data[0], lat: r.data[1], speed: r.data[3] });
    }
    let houses = null;
    if (q.houses) {
      const h = sweph.houses_ex2(jd, q.zodiac !== "tropical" ? C.SEFLG_SIDEREAL : 0, q.latitude, q.longitude, HOUSE_SYSTEMS[q.house_system]);
      if (h.flag < 0) {
        // The angles are still valid when a house system fails (Swiss Ephemeris falls back internally).
        houses = { error: `${q.house_system} houses cannot be calculated at this latitude.`, asc: h.data.points[0], mc: h.data.points[1] };
      } else {
        const [asc, mc, armc, vertex] = h.data.points;
        houses = { cusps: h.data.houses.slice(0, 12), asc, mc, armc, vertex };
      }
    }
    const ayanamsa = q.zodiac !== "tropical" ? sweph.get_ayanamsa_ex_ut(jd, flags).data : null;
    return { instant: date.toISOString(), jd_ut: jd, placements, houses, ayanamsa, warnings: [...warnings] };
  });

  return {
    engine: engineInfo(),
    settings: { zodiac: q.zodiac, house_system: q.house_system, frame: "apparent geocentric, true ecliptic and equinox of date" },
    results,
    source: SOURCE_URL,
  };
}
