import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { compute } from "../lib/compute.js";

const horizons = JSON.parse(fs.readFileSync(new URL("./horizons.json", import.meta.url), "utf8"));
const sep = (a, b) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

test("positions agree with NASA JPL Horizons to within 2 arcseconds", () => {
  const r = compute({ instants: horizons.dates, latitude: 0, longitude: 0, houses: false });
  for (const [key, values] of Object.entries(horizons.positions)) {
    r.results.forEach((res, i) => {
      const p = res.placements.find((x) => x.key === key);
      assert.ok(sep(p.lon, values[i]) < 2 / 3600, `${key} on ${horizons.dates[i]}: ${p.lon} vs ${values[i]}`);
    });
  }
  for (const res of r.results) assert.deepEqual(res.warnings, []);
});

test("houses: Placidus cusps, angles, and refusal inside the polar circle", () => {
  const r = compute({ instants: ["1985-03-01T22:00:00Z"], latitude: 51.5074, longitude: -0.1278, bodies: ["sun"] });
  const h = r.results[0].houses;
  assert.equal(h.cusps.length, 12);
  assert.ok(sep(h.cusps[0], h.asc) < 1e-9);
  assert.ok(sep(h.cusps[9], h.mc) < 1e-9);
  const polar = compute({ instants: ["2024-06-21T12:00:00Z"], latitude: 69.65, longitude: 18.95, bodies: ["sun"] });
  assert.match(polar.results[0].houses.error, /cannot be calculated/);
  const whole = compute({ instants: ["2024-06-21T12:00:00Z"], latitude: 69.65, longitude: 18.95, bodies: ["sun"], house_system: "whole_sign" });
  assert.equal(whole.results[0].houses.cusps[0] % 30, 0);
});

test("sidereal zodiac subtracts the ayanamsa", () => {
  const t = compute({ instants: ["2000-01-01T12:00:00Z"], latitude: 0, longitude: 0, bodies: ["sun"], houses: false });
  const s = compute({ instants: ["2000-01-01T12:00:00Z"], latitude: 0, longitude: 0, bodies: ["sun"], houses: false, zodiac: "lahiri" });
  const ay = s.results[0].ayanamsa;
  assert.ok(ay > 23.8 && ay < 23.9, `Lahiri ayanamsa at J2000 ${ay}`);
  assert.ok(sep(t.results[0].placements[0].lon - ay, s.results[0].placements[0].lon) < 1e-3);
});

test("Chiron and the true node are available", () => {
  const r = compute({ instants: ["2000-01-01T12:00:00Z"], latitude: 0, longitude: 0, bodies: ["chiron", "true_node", "mean_node"], houses: false });
  assert.equal(r.results[0].placements.length, 3);
});

test("rejects bad input", () => {
  assert.throws(() => compute({ instants: [], latitude: 0, longitude: 0 }), /instants/);
  assert.throws(() => compute({ instants: ["nope"], latitude: 0, longitude: 0 }), /timestamp/);
  assert.throws(() => compute({ instants: ["2000-01-01T00:00:00Z"], latitude: 95, longitude: 0 }), /latitude/);
  assert.throws(() => compute({ instants: ["2000-01-01T00:00:00Z"], latitude: 0, longitude: 0, house_system: "x" }), /house_system/);
  assert.throws(() => compute({ instants: Array(9).fill("2000-01-01T00:00:00Z"), latitude: 0, longitude: 0 }), /instants/);
});
