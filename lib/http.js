// HTTP handling shared by the Vercel functions (api/) and the stand-alone server (server.js).
// Copyright (C) 2026 Scryway. AGPL-3.0-or-later (see LICENSE).

import { InputError, SOURCE_URL, compute, engineInfo } from "./compute.js";

const DEFAULT_ORIGINS = ["https://www.scryway.com", "https://scryway.com", "https://scryway.vercel.app", "http://localhost:3000"];
const allowed = () => (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS);
// Preview deployments of the Scryway project.
const PREVIEW = /^https:\/\/scryway-[a-z0-9-]+-aaronhawks-projects\.vercel\.app$/;

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (allowed().includes(origin) || PREVIEW.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  // The AGPL source offer travels with every response.
  res.setHeader("X-Source-Code", SOURCE_URL);
  res.setHeader("X-License", "AGPL-3.0-or-later");
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function info(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return send(res, 204, {});
  send(res, 200, {
    service: "Scryway Ephemeris",
    description: "Astrological calculation service used by Scryway. Positions, house cusps and angles from the Swiss Ephemeris.",
    license: "GNU Affero General Public License v3.0 or later",
    source: SOURCE_URL,
    engine: engineInfo(),
    endpoints: { "POST /compute": "See the README for the request format.", "GET /source": "Redirects to the source code." },
    privacy: "Requests are calculated and answered; nothing in them is stored or logged by this service.",
  });
}

export async function computeHandler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { error: "Use POST with a JSON body." });
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    send(res, 200, compute(body));
  } catch (e) {
    if (e instanceof InputError || e instanceof SyntaxError) return send(res, 400, { error: e.message, source: SOURCE_URL });
    send(res, 500, { error: "Calculation failed.", source: SOURCE_URL });
  }
}

export function sourceRedirect(_req, res) {
  res.statusCode = 302;
  res.setHeader("Location", SOURCE_URL);
  res.end();
}
